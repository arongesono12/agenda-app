import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessPathForRole, getLandingPathForRole, PUBLIC_ROUTES } from '@/lib/access-control'
import { ORGANISMO_COOKIE, obtenerSuscripcion, resolverOrganismoActivo, suscripcionActiva } from '@/lib/organismo-access'
import { rejectUnsafeMutation } from '@/lib/request-security'
import type { Database } from '@/lib/database.types'

type CookieMutation = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie)
  })
}

function isApiRoute(pathname: string) {
  return pathname.startsWith('/api/')
}

function isExternalApiRoute(pathname: string) {
  return pathname === '/api/billing/webhook' || pathname === '/api/bootstrap/agenda-users'
}

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

function isOrganismoNuevo(pathname: string) {
  return pathname === '/organismos/nuevo' || pathname.startsWith('/organismos/nuevo/')
}

function isSeleccionarOrganismo(pathname: string) {
  return pathname === '/seleccionar-organismo'
}

function isSubscriptionGateExempt(pathname: string) {
  if (pathname === '/planes' || pathname.startsWith('/planes/')) return true
  if (pathname === '/api/billing/checkout' || pathname === '/api/billing/portal' || pathname === '/api/billing/webhook' || pathname === '/api/billing/bank-transfer') return true
  if (pathname.startsWith('/api/organismos')) return true
  if (pathname.startsWith('/organismos/nuevo')) return true
  if (pathname === '/seleccionar-organismo') return true
  if (/^\/organismos\/[^/]+\/facturacion(?:\/|$)/.test(pathname)) return true
  return false
}

async function loadOrganismoSlug(supabase: ReturnType<typeof createServerClient<Database>>, organismoId: string) {
  const { data } = await supabase
    .from('organismos')
    .select('slug')
    .eq('id', organismoId)
    .maybeSingle()

  return data?.slug ?? null
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieMutation[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          response = NextResponse.next({
            request: { headers: request.headers },
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname === '/login'
  const isRegisterRoute = pathname === '/registro'
  const isPasswordRecoveryRoute = pathname === '/recuperar-password' || pathname === '/actualizar-password'
  const isPasswordRecoveryCallback = pathname === '/auth/callback'
  const isPasswordRecoveryApi = pathname === '/api/auth/recovery' || pathname === '/api/auth/password'
  const isRegisterApi = pathname === '/api/register'
  const isBootstrapApi = pathname === '/api/bootstrap/agenda-users'
  const isBillingWebhook = pathname === '/api/billing/webhook'
  const isPublic = isPublicRoute(pathname)
  const isProtectedRoute =
    !isLoginRoute &&
    !isRegisterRoute &&
    !isPasswordRecoveryRoute &&
    !isPasswordRecoveryCallback &&
    !isPasswordRecoveryApi &&
    !isRegisterApi &&
    !isBootstrapApi &&
    !isBillingWebhook &&
    !isPublic

  if (isApiRoute(pathname) && !isExternalApiRoute(pathname)) {
    const unsafeMutation = rejectUnsafeMutation(request)
    if (unsafeMutation) return unsafeMutation
  }

  let resolvedRoleCode: string | null = null

  const loadRoleCode = async (organismoId: string | null) => {
    if (!claims?.sub) return 'consulta'
    if (resolvedRoleCode) return resolvedRoleCode

    // Preferir el rol del organismo activo si existe
    if (organismoId) {
      const { data: miembro } = await supabase
        .from('organismo_miembros')
        .select('rol_codigo')
        .eq('usuario_id', claims.sub)
        .eq('organismo_id', organismoId)
        .eq('activo', true)
        .maybeSingle()

      if (miembro?.rol_codigo) {
        resolvedRoleCode = (miembro.rol_codigo as string).trim().toLowerCase()
        return resolvedRoleCode
      }
    }

    // Fallback: rol global del perfil
    const { data: profile } = await supabase
      .from('perfiles_usuario')
      .select('tipo_usuario:tipos_usuario(codigo)')
      .eq('id', claims.sub)
      .maybeSingle()

    const roleRow = profile as { tipo_usuario?: { codigo?: string } | Array<{ codigo?: string }> | null } | null
    const rawRole = Array.isArray(roleRow?.tipo_usuario) ? roleRow?.tipo_usuario[0]?.codigo : roleRow?.tipo_usuario?.codigo
    resolvedRoleCode = rawRole?.trim().toLowerCase() || 'consulta'

    return resolvedRoleCode
  }

  // ── Rutas no protegidas ─────────────────────────────────────────────────────

  if (!claims && isProtectedRoute) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ ok: false, error: 'Autenticacion requerida.' }, { status: 401 })
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const requestedPath =
      pathname === '/' ? '/' : `${pathname}${request.nextUrl.search}${request.nextUrl.hash}`
    loginUrl.searchParams.set('next', requestedPath)

    const redirectResponse = NextResponse.redirect(loginUrl)
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  // ── Usuario autenticado ─────────────────────────────────────────────────────

  if (claims && isProtectedRoute) {
    const cookieOrganismoId = request.cookies.get(ORGANISMO_COOKIE)?.value ?? null

    // Resolver el organismo activo (skip for organism management pages)
    let organismoId: string | null = null
    let redirigir: string | null = null

    if (!isOrganismoNuevo(pathname) && !isSeleccionarOrganismo(pathname)) {
      const userEmail = (claims as Record<string, unknown>).email as string | undefined
      const resolved = await resolverOrganismoActivo(supabase, claims.sub, cookieOrganismoId, userEmail)
      organismoId = resolved.organismoId
      redirigir = resolved.redirigir

      if (redirigir) {
        if (isApiRoute(pathname)) {
          return NextResponse.json({ ok: false, error: 'No hay organismo activo.' }, { status: 403 })
        }

        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = redirigir
        redirectUrl.search = ''
        const redirectResponse = NextResponse.redirect(redirectUrl)
        copyCookies(response, redirectResponse)
        return redirectResponse
      }
    }

    const roleCode = await loadRoleCode(organismoId)

    // Verificar acceso a la ruta
    if (!isApiRoute(pathname) && !canAccessPathForRole(roleCode, pathname)) {
      const forbiddenUrl = request.nextUrl.clone()
      forbiddenUrl.pathname = '/forbidden'
      forbiddenUrl.search = ''
      const redirectResponse = NextResponse.redirect(forbiddenUrl)
      copyCookies(response, redirectResponse)
      return redirectResponse
    }

    if (organismoId && !isSubscriptionGateExempt(pathname)) {
      const suscripcion = await obtenerSuscripcion(supabase, organismoId)

      if (!suscripcionActiva(suscripcion)) {
        if (isApiRoute(pathname)) {
          return NextResponse.json(
            { ok: false, error: 'La suscripcion del organismo no esta activa.' },
            { status: 402 }
          )
        }

        const slug = await loadOrganismoSlug(supabase, organismoId)
        const billingUrl = request.nextUrl.clone()
        billingUrl.pathname = slug ? `/organismos/${slug}/facturacion` : '/planes'
        billingUrl.search = ''
        const redirectResponse = NextResponse.redirect(billingUrl)
        copyCookies(response, redirectResponse)
        return redirectResponse
      }
    }

    // Inyectar organismo en headers para las API routes
    const requestHeaders = new Headers(request.headers)
    if (organismoId) {
      requestHeaders.set('x-organismo-id', organismoId)
    }
    if (claims.sub) {
      requestHeaders.set('x-user-id', claims.sub)
    }
    if (roleCode) {
      requestHeaders.set('x-organismo-rol', roleCode)
    }

    response = NextResponse.next({ request: { headers: requestHeaders } })

    // Persistir organismo en cookie si se auto-resolvió
    if (organismoId && !cookieOrganismoId) {
      response.cookies.set(ORGANISMO_COOKIE, organismoId, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 días
      })
    }
  }

  // Redirigir login si ya está autenticado
  if (claims && isLoginRoute) {
    const cookieOrganismoId = request.cookies.get(ORGANISMO_COOKIE)?.value ?? null
    const roleCode = await loadRoleCode(cookieOrganismoId)
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = getLandingPathForRole(roleCode)
    appUrl.search = ''

    const redirectResponse = NextResponse.redirect(appUrl)
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  return response
}
