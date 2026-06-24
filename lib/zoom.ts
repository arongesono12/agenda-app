type ZoomTokenResponse = {
  access_token?: string
  expires_in?: number
  token_type?: string
  error?: string
  reason?: string
}

type ZoomMeetingResponse = {
  id?: number
  uuid?: string
  topic?: string
  join_url?: string
  start_url?: string
  password?: string
  host_id?: string
}

export type ZoomMeetingInput = {
  topic: string
  agenda?: string | null
  startTime: string
  durationMinutes: number
  timezone?: string
}

export type CreatedZoomMeeting = {
  id: string
  uuid?: string | null
  joinUrl: string
  startUrl?: string | null
  password?: string | null
  hostId?: string | null
}

function getZoomEnv() {
  const accountId = process.env.ZOOM_ACCOUNT_ID?.trim()
  const clientId = process.env.ZOOM_CLIENT_ID?.trim()
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim()
  const userId = process.env.ZOOM_USER_ID?.trim() || 'me'

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Faltan ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID o ZOOM_CLIENT_SECRET en el entorno.')
  }

  return { accountId, clientId, clientSecret, userId }
}

async function readZoomError(response: Response, fallback: string) {
  const text = await response.text().catch(() => '')
  if (!text) return fallback

  try {
    const parsed = JSON.parse(text) as { message?: string; reason?: string; error?: string }
    return parsed.message || parsed.reason || parsed.error || fallback
  } catch {
    return text
  }
}

async function getZoomAccessToken() {
  const { accountId, clientId, clientSecret } = getZoomEnv()
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const url = new URL('https://zoom.us/oauth/token')
  url.searchParams.set('grant_type', 'account_credentials')
  url.searchParams.set('account_id', accountId)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readZoomError(response, 'No se pudo autenticar con Zoom.'))
  }

  const data = (await response.json()) as ZoomTokenResponse
  if (!data.access_token) {
    throw new Error(data.reason || data.error || 'Zoom no devolvio un token de acceso.')
  }

  return data.access_token
}

export async function createZoomMeeting(input: ZoomMeetingInput): Promise<CreatedZoomMeeting> {
  const { userId } = getZoomEnv()
  const token = await getZoomAccessToken()
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startTime,
      duration: input.durationMinutes,
      timezone: input.timezone ?? 'Africa/Malabo',
      agenda: input.agenda || undefined,
      settings: {
        join_before_host: false,
        waiting_room: true,
        mute_upon_entry: true,
        approval_type: 2,
        audio: 'both',
        auto_recording: 'none',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(await readZoomError(response, 'No se pudo crear la reunion en Zoom.'))
  }

  const data = (await response.json()) as ZoomMeetingResponse
  if (!data.id || !data.join_url) {
    throw new Error('Zoom creo una respuesta incompleta sin enlace de reunion.')
  }

  return {
    id: String(data.id),
    uuid: data.uuid ?? null,
    joinUrl: data.join_url,
    startUrl: data.start_url ?? null,
    password: data.password ?? null,
    hostId: data.host_id ?? null,
  }
}
