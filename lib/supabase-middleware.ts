import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
  const isLocalRegisterRoute = process.env.NODE_ENV !== 'production' && pathname === '/registro-local'
  const isLocalRegisterApi = process.env.NODE_ENV !== 'production' && pathname === '/api/local/register'
  const isProtectedRoute = !isLoginRoute && !isLocalRegisterRoute && !isLocalRegisterApi

  if (!claims && isProtectedRoute) {
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
