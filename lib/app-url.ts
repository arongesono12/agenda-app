function parseOrigin(value?: string | null) {
  const candidate = value?.trim().replace(/\/$/, '')
  if (!candidate) return null

  try {
    return new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`).origin
  } catch {
    return null
  }
}

function isLocalOrigin(origin: string) {
  const hostname = new URL(origin).hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function getPublicAppOrigin(request: Request) {
  const configuredOrigin = parseOrigin(process.env.NEXT_PUBLIC_APP_URL)

  if (configuredOrigin && (process.env.NODE_ENV !== 'production' || !isLocalOrigin(configuredOrigin))) {
    return configuredOrigin
  }

  const vercelOrigin = parseOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  )
  if (vercelOrigin) return vercelOrigin

  const requestOrigin = new URL(request.url).origin
  if (process.env.NODE_ENV === 'production' && isLocalOrigin(requestOrigin)) {
    throw new Error('NEXT_PUBLIC_APP_URL debe contener la URL publica HTTPS de la aplicacion.')
  }

  return requestOrigin
}
