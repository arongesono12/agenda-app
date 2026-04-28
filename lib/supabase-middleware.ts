import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'

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

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
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
            request: {
              headers: request.headers,
            },
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
  const isRegisterApi = pathname === '/api/register'
  const isLocalRegisterRoute = process.env.NODE_ENV !== 'production' && pathname === '/registro-local'
  const isLocalRegisterApi = process.env.NODE_ENV !== 'production' && pathname === '/api/local/register'
  const isBootstrapApi = pathname === '/api/bootstrap/agenda-users'
  const isProtectedRoute = !isLoginRoute && !isRegisterRoute && !isRegisterApi && !isLocalRegisterRoute && !isLocalRegisterApi && !isBootstrapApi
  const isAdminOnlyRoute = pathname === '/catalogos' || isLocalRegisterRoute || isLocalRegisterApi

  if (!claims && isProtectedRoute) {
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Autenticacion requerida.',
        },
        { status: 401 }
      )
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'

    const requestedPath =
      pathname === '/'
        ? '/'
        : `${pathname}${request.nextUrl.search}${request.nextUrl.hash}`

    loginUrl.searchParams.set('next', requestedPath)

    const redirectResponse = NextResponse.redirect(loginUrl)
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  if (claims && isAdminOnlyRoute) {
    const { data: profile } = await supabase
      .from('perfiles_usuario')
      .select('tipo_usuario:tipos_usuario(codigo)')
      .eq('id', claims.sub)
      .maybeSingle()

    const roleRow = profile as { tipo_usuario?: { codigo?: string } | Array<{ codigo?: string }> | null } | null
    const rawRole = Array.isArray(roleRow?.tipo_usuario) ? roleRow?.tipo_usuario[0]?.codigo : roleRow?.tipo_usuario?.codigo
    const roleCode = rawRole?.trim().toLowerCase() ?? ''

    if (!ADMIN_ROLE_CODES.includes(roleCode as (typeof ADMIN_ROLE_CODES)[number])) {
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'No tienes permisos para acceder a este recurso.',
          },
          { status: 403 }
        )
      }

      const forbiddenUrl = request.nextUrl.clone()
      forbiddenUrl.pathname = '/forbidden'
      forbiddenUrl.search = ''

      const redirectResponse = NextResponse.redirect(forbiddenUrl)
      copyCookies(response, redirectResponse)
      return redirectResponse
    }
  }

  if (claims && isLoginRoute) {
    const appUrl = request.nextUrl.clone()
    appUrl.pathname = '/'
    appUrl.search = ''

    const redirectResponse = NextResponse.redirect(appUrl)
    copyCookies(response, redirectResponse)
    return redirectResponse
  }

  return response
}
