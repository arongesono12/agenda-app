import { createHmac } from 'crypto'

export type ZoomVideoSdkTokenInput = {
  sessionName: string
  roleType: 0 | 1
  userIdentity: string
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function getVideoSdkEnv() {
  const sdkKey = process.env.ZOOM_VIDEO_SDK_KEY?.trim() || process.env.ZOOM_CLIENT_ID?.trim()
  const sdkSecret = process.env.ZOOM_VIDEO_SDK_SECRET?.trim() || process.env.ZOOM_CLIENT_SECRET?.trim()

  if (!sdkKey || !sdkSecret) {
    throw new Error('Faltan ZOOM_VIDEO_SDK_KEY y ZOOM_VIDEO_SDK_SECRET en el entorno.')
  }

  return { sdkKey, sdkSecret }
}

export function getVideoSdkPasscode() {
  return process.env.ZOOM_VIDEO_SDK_SESSION_PASSCODE?.trim() || 'agenda'
}

export function buildAgendaVideoSessionName(organismoId: string, reunionId: string) {
  return `agenda-${organismoId.slice(0, 8)}-${reunionId}`
}

export function createZoomVideoSdkJwt(input: ZoomVideoSdkTokenInput) {
  const { sdkKey, sdkSecret } = getVideoSdkEnv()
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    app_key: sdkKey,
    tpc: input.sessionName,
    role_type: input.roleType,
    session_key: input.sessionName,
    user_identity: input.userIdentity,
    version: 1,
    iat: now - 30,
    exp: now + 60 * 60 * 2,
  }
  const header = { alg: 'HS256', typ: 'JWT' }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const signature = createHmac('sha256', sdkSecret).update(unsigned).digest()

  return `${unsigned}.${base64Url(signature)}`
}
