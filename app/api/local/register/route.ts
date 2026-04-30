import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import { hasAnyRole, ADMIN_ROLE_CODES } from '@/lib/access-control'

export const dynamic = 'force-dynamic'

type RegisterPayload = {
  email?: string
  password?: string
  roleCode?: string
  departamento?: string
}

const ALLOWED_ROLE_CODES = ['administrador', 'administradora', 'supervisor', 'responsable', 'consulta'] as const

function normalizeRoleCode(value?: string) {
  const roleCode = value?.trim().toLowerCase() || 'responsable'
  return ALLOWED_ROLE_CODES.includes(roleCode as (typeof ALLOWED_ROLE_CODES)[number]) ? roleCode : null
}

function fallbackNameFromEmail(email: string) {
  return email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || email
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
    const roleCode = normalizeRoleCode(body.roleCode)
    const departamento = body.departamento?.trim()

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Correo y contraseña son obligatorios.',
        },
        { status: 400 }
      )
    }

    if (!roleCode) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecciona un rol valido para el usuario.',
        },
        { status: 400 }
      )
    }

    if (!departamento) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecciona un departamento para el usuario.',
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

    const { data: roleRow, error: roleError } = await admin
      .from('tipos_usuario')
      .select('id, codigo, nombre')
      .eq('codigo', roleCode)
      .maybeSingle()

    if (roleError) {
      throw roleError
    }

    if (!roleRow) {
      return NextResponse.json(
        {
          ok: false,
          error: `El rol "${roleCode}" no existe en tipos_usuario. Ejecuta migration_user_profiles.sql primero.`,
        },
        { status: 400 }
      )
    }

    const { data: departamentoRow, error: departamentoError } = await admin
      .from('departamentos')
      .select('nombre')
      .eq('nombre', departamento)
      .eq('activo', true)
      .maybeSingle()

    if (departamentoError) {
      throw departamentoError
    }

    if (!departamentoRow) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecciona un departamento valido.',
        },
        { status: 400 }
      )
    }

    let userId = ''
    let action: 'created' | 'updated' = 'created'

    const existingUser = (listedUsers.users ?? []).find((user) => user.email?.toLowerCase() === email)

    if (existingUser) {
      const { data: updatedUser, error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
      })

      if (updateError) {
        throw updateError
      }

      userId = updatedUser.user.id
      action = 'updated'
    } else {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError) {
        throw createError
      }

      userId = createdUser.user.id
    }

    const { error: profileError } = await admin.from('perfiles_usuario').upsert(
      {
        id: userId,
        email,
        nombre_completo: fallbackNameFromEmail(email),
        tipo_usuario_id: roleRow.id,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      throw profileError
    }

    const { data: responsable, error: responsableLookupError } = await admin
      .from('responsables')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (responsableLookupError && responsableLookupError.code !== '42P01') {
      throw responsableLookupError
    }

    if (responsableLookupError?.code !== '42P01') {
      const responsablePayload = {
        nombre: fallbackNameFromEmail(email),
        email,
        usuario_id: userId,
        departamento: departamentoRow.nombre,
        cargo: roleRow.nombre,
        activo: true,
      }

      const { error: responsableSaveError } = responsable?.id
        ? await admin.from('responsables').update(responsablePayload).eq('id', responsable.id)
        : await admin.from('responsables').insert(responsablePayload)

      if (responsableSaveError) {
        throw responsableSaveError
      }
    }

    return NextResponse.json({
      ok: true,
      user: {
        email,
        action,
        id: userId,
        role: roleRow.nombre,
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
