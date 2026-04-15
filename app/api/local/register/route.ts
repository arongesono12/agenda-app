import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { hasAnyRole, ADMIN_ROLE_CODES } from '@/lib/access-control'

export const dynamic = 'force-dynamic'

type RegisterPayload = {
  email?: string
  password?: string
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Ruta no disponible en producción.',
      },
      { status: 404 }
    )
  }

  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, ADMIN_ROLE_CODES)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo un administrador autenticado puede crear usuarios locales.',
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as RegisterPayload
    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ''

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Correo y contraseña son obligatorios.',
        },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: 'La contraseña debe tener al menos 8 caracteres.',
        },
        { status: 400 }
      )
    }

    const admin = createAdminSupabaseClient()
    const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (listError) {
      throw listError
    }

    const existingUser = (listedUsers.users ?? []).find((user) => user.email?.toLowerCase() === email)

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      })

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({
        ok: true,
        user: {
          email,
          action: 'updated',
          id: updatedUser.user.id,
        },
      })
    }

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      throw createError
    }

    return NextResponse.json({
      ok: true,
      user: {
        email,
        action: 'created',
        id: createdUser.user.id,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo crear el usuario.',
      },
      { status: 500 }
    )
  }
}
