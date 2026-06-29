import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { rejectRateLimited } from '@/lib/request-security'

export const dynamic = 'force-dynamic'

type PasswordBody = {
  password?: string
  confirmPassword?: string
}

export async function POST(request: Request) {
  const rateLimited = rejectRateLimited(request, 'password-update', {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  })
  if (rateLimited) return rateLimited

  let body: PasswordBody
  try {
    body = (await request.json()) as PasswordBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Peticion no valida.' }, { status: 400 })
  }

  const password = body.password ?? ''
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'La contrasena debe tener al menos 8 caracteres.' },
      { status: 400 }
    )
  }
  if (password !== body.confirmPassword) {
    return NextResponse.json({ ok: false, error: 'Las contrasenas no coinciden.' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, error: 'El enlace de recuperacion no es valido o ya expiro.' },
      { status: 401 }
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    console.error('Password update failed:', updateError.message)
    return NextResponse.json(
      { ok: false, error: 'No se pudo actualizar la contrasena.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ ok: true })
}
