import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getPublicAppOrigin } from '@/lib/app-url'
import { rejectRateLimited } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

type RecoveryBody = {
  email?: string
}

export async function POST(request: Request) {
  const rateLimited = rejectRateLimited(request, 'password-recovery', {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (rateLimited) return rateLimited

  let body: RecoveryBody
  try {
    body = (await request.json()) as RecoveryBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Peticion no valida.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Introduce un correo valido.' }, { status: 400 })
  }

  try {
    const origin = getPublicAppOrigin(request)
    const callbackUrl = new URL('/auth/callback', origin)
    callbackUrl.searchParams.set('next', '/actualizar-password')

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl.toString(),
    })

    if (error) {
      console.error('Password recovery request failed:', error.message)
      return NextResponse.json(
        { ok: false, error: 'No se pudo enviar el enlace de recuperacion.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Password recovery configuration failed:', error)
    return NextResponse.json(
      { ok: false, error: 'La recuperacion de contrasena no esta configurada correctamente.' },
      { status: 500 }
    )
  }
}
