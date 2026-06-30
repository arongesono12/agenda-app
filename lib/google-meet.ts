import { createSign } from 'crypto'

const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_MEET_SPACES_URL = 'https://meet.googleapis.com/v2/spaces'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type GoogleMeetSpaceResponse = {
  name?: string
  meetingUri?: string
  meetingCode?: string
  config?: {
    accessType?: GoogleMeetAccessType
    entryPointAccess?: 'ALL' | 'CREATOR_APP_ONLY'
  }
  activeConference?: { conferenceRecord?: string }
}

export type GoogleMeetAccessType = 'OPEN' | 'TRUSTED' | 'RESTRICTED'

export type CreatedGoogleMeetSpace = {
  name: string
  meetingUri: string
  meetingCode?: string | null
}

export type GoogleMeetErrorCode =
  | 'GOOGLE_MEET_CONFIG_MISSING'
  | 'GOOGLE_MEET_AUTH_FAILED'
  | 'GOOGLE_MEET_CREATE_FAILED'

export class GoogleMeetIntegrationError extends Error {
  readonly code: GoogleMeetErrorCode
  readonly status: number

  constructor(code: GoogleMeetErrorCode, message: string, status = 503) {
    super(message)
    this.name = 'GoogleMeetIntegrationError'
    this.code = code
    this.status = status
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function getGoogleMeetEnv() {
  return {
    apiKey: process.env.GOOGLE_MEET_API_KEY?.trim() || '',
    clientId: process.env.GOOGLE_MEET_CLIENT_ID?.trim() || '',
    clientSecret: process.env.GOOGLE_MEET_CLIENT_SECRET?.trim() || '',
    refreshToken: process.env.GOOGLE_MEET_REFRESH_TOKEN?.trim() || '',
    serviceAccountEmail: process.env.GOOGLE_MEET_SERVICE_ACCOUNT_EMAIL?.trim() || '',
    serviceAccountPrivateKey: process.env.GOOGLE_MEET_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n').trim() || '',
    impersonatedUser: process.env.GOOGLE_MEET_IMPERSONATED_USER?.trim() || '',
    accessType: process.env.GOOGLE_MEET_ACCESS_TYPE?.trim().toUpperCase() || 'OPEN',
  }
}

async function readGoogleError(response: Response, fallback: string) {
  const text = await response.text().catch(() => '')
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text) as {
      error?: string | { message?: string; status?: string }
      error_description?: string
    }
    if (typeof parsed.error === 'object') return parsed.error.message || parsed.error.status || fallback
    return parsed.error_description || parsed.error || fallback
  } catch {
    return text
  }
}

function createServiceAccountAssertion(params: {
  email: string
  privateKey: string
  impersonatedUser: string
}) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: params.email,
    sub: params.impersonatedUser,
    scope: MEET_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now - 30,
    exp: now + 3600,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  return `${unsigned}.${base64Url(signer.sign(params.privateKey))}`
}

async function requestAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value

  const env = getGoogleMeetEnv()
  const body = new URLSearchParams()

  if (env.clientId && env.clientSecret && env.refreshToken) {
    body.set('grant_type', 'refresh_token')
    body.set('client_id', env.clientId)
    body.set('client_secret', env.clientSecret)
    body.set('refresh_token', env.refreshToken)
  } else if (env.serviceAccountEmail && env.serviceAccountPrivateKey && env.impersonatedUser) {
    body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer')
    body.set('assertion', createServiceAccountAssertion({
      email: env.serviceAccountEmail,
      privateKey: env.serviceAccountPrivateKey,
      impersonatedUser: env.impersonatedUser,
    }))
  } else {
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_CONFIG_MISSING',
      'Google Meet necesita OAuth 2.0. La API key sola no puede crear reuniones. Configura un refresh token o una cuenta de servicio con delegacion de dominio.'
    )
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })
  if (!response.ok) {
    const reason = await readGoogleError(response, 'Google rechazo la autorizacion OAuth 2.0.')
    console.error('Google Meet OAuth failed:', reason)
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_AUTH_FAILED',
      'Google Meet no pudo autorizar la cuenta organizadora. Revisa las credenciales OAuth, el scope y la delegacion configurada.'
    )
  }

  const token = (await response.json()) as GoogleTokenResponse
  if (!token.access_token) {
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_AUTH_FAILED',
      token.error_description || token.error || 'Google no devolvio un token de acceso.'
    )
  }

  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.max(300, token.expires_in ?? 3600) * 1000,
  }
  return token.access_token
}

export async function createGoogleMeetSpace(): Promise<CreatedGoogleMeetSpace> {
  const token = await requestAccessToken()
  const { apiKey, accessType } = getGoogleMeetEnv()
  if (!['OPEN', 'TRUSTED', 'RESTRICTED'].includes(accessType)) {
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_CONFIG_MISSING',
      'GOOGLE_MEET_ACCESS_TYPE debe ser OPEN, TRUSTED o RESTRICTED.'
    )
  }
  const response = await fetch(GOOGLE_MEET_SPACES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Goog-Api-Key': apiKey } : {}),
    },
    body: JSON.stringify({
      config: {
        accessType,
        entryPointAccess: 'ALL',
      },
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const reason = await readGoogleError(response, 'Google Meet no pudo crear el espacio.')
    console.error('Google Meet space creation failed:', reason)
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_CREATE_FAILED',
      `No se pudo crear la reunion en Google Meet: ${reason}`,
      response.status === 401 || response.status === 403 ? 503 : 502
    )
  }

  const space = (await response.json()) as GoogleMeetSpaceResponse
  if (!space.name || !space.meetingUri) {
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_CREATE_FAILED',
      'Google Meet creo una respuesta incompleta sin enlace de reunion.',
      502
    )
  }

  return {
    name: space.name,
    meetingUri: space.meetingUri,
    meetingCode: space.meetingCode ?? null,
  }
}

function normalizeSpaceName(name: string) {
  const normalized = name.trim()
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new GoogleMeetIntegrationError(
      'GOOGLE_MEET_CONFIG_MISSING',
      'El identificador del espacio de Google Meet no es valido.',
      400
    )
  }
  return normalized
}

async function authorizedMeetRequest(path: string, init?: RequestInit) {
  const token = await requestAccessToken()
  const { apiKey } = getGoogleMeetEnv()
  return fetch(`${GOOGLE_MEET_SPACES_URL}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-Goog-Api-Key': apiKey } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  })
}

export async function getGoogleMeetSpace(name: string) {
  const normalized = normalizeSpaceName(name)
  const response = await authorizedMeetRequest(encodeURIComponent(normalized.split('/')[1]))
  if (!response.ok) {
    const reason = await readGoogleError(response, 'No se pudo consultar el espacio de Google Meet.')
    throw new GoogleMeetIntegrationError('GOOGLE_MEET_CREATE_FAILED', reason, response.status === 404 ? 404 : 502)
  }
  return (await response.json()) as GoogleMeetSpaceResponse
}

export async function updateGoogleMeetSpaceAccess(name: string, accessType: GoogleMeetAccessType) {
  const normalized = normalizeSpaceName(name)
  const spaceId = encodeURIComponent(normalized.split('/')[1])
  const response = await authorizedMeetRequest(`${spaceId}?updateMask=config.accessType,config.entryPointAccess`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: normalized,
      config: { accessType, entryPointAccess: 'ALL' },
    }),
  })
  if (!response.ok) {
    const reason = await readGoogleError(response, 'No se pudo actualizar el espacio de Google Meet.')
    throw new GoogleMeetIntegrationError('GOOGLE_MEET_CREATE_FAILED', reason, 502)
  }
  return (await response.json()) as GoogleMeetSpaceResponse
}

export async function endActiveGoogleMeetConference(name: string) {
  const normalized = normalizeSpaceName(name)
  const spaceId = encodeURIComponent(normalized.split('/')[1])
  const response = await authorizedMeetRequest(`${spaceId}:endActiveConference`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!response.ok) {
    const reason = await readGoogleError(response, 'No se pudo finalizar la conferencia activa de Google Meet.')
    throw new GoogleMeetIntegrationError('GOOGLE_MEET_CREATE_FAILED', reason, 502)
  }
}
