import { NextResponse } from 'next/server'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function normalizeHost(value: string | null) {
  return value?.trim().toLowerCase() || ''
}

function getRequestOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin) return origin

  const referer = request.headers.get('referer')
  if (!referer) return null

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

export function rejectUnsafeMutation(request: Request) {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) return null

  const host = normalizeHost(request.headers.get('host'))
  const requestOrigin = getRequestOrigin(request)

  if (!host || !requestOrigin) {
    return NextResponse.json(
      { ok: false, error: 'Peticion no autorizada.' },
      { status: 403 }
    )
  }

  try {
    const originHost = normalizeHost(new URL(requestOrigin).host)
    if (originHost === host) return null
  } catch {
    // Fall through to the rejection below.
  }

  return NextResponse.json(
    { ok: false, error: 'Origen de peticion no autorizado.' },
    { status: 403 }
  )
}

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || ''
}

export function emailsMatch(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeEmail(left)
  const normalizedRight = normalizeEmail(right)
  return !!normalizedLeft && !!normalizedRight && normalizedLeft === normalizedRight
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function rejectRateLimited(
  request: Request,
  scope: string,
  options: { limit: number; windowMs: number }
) {
  const now = Date.now()
  const key = `${scope}:${getClientKey(request)}`
  const current = rateLimitStore.get(key)

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs })
    return null
  }

  if (current.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return NextResponse.json(
      { ok: false, error: 'Demasiadas solicitudes. Intentalo de nuevo mas tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  current.count += 1
  return null
}
