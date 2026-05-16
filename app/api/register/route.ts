import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { PUBLIC_REGISTRATION_ROLE_CODES, PUBLIC_REGISTRATION_ROLES, REGISTRATION_DEPARTAMENTOS } from '@/lib/registration-options'

export const dynamic = 'force-dynamic'

type RegisterPayload = {
  email?: string
  password?: string
  fullName?: string
  roleCode?: string
  departamento?: string
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>
type ResponsablePayload = {
  email: string
  fullName: string
  userId: string
  departamento: string
  roleName: string
}

function fallbackNameFromEmail(email: string) {
  return email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || email
}

function normalizeRoleCode(value?: string) {
  return value?.trim().toLowerCase() || 'responsable'
}

function normalizeCatalogText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function isRegistrationRole(roleCode?: string | null) {
  const normalizedRole = roleCode?.trim().toLowerCase()
  return !!normalizedRole && PUBLIC_REGISTRATION_ROLE_CODES.includes(normalizedRole)
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined, columns: string[]) {
  const message = error?.message ?? ''
  return (
    (error?.code === 'PGRST204' || error?.code === '42703') &&
    columns.some((column) => message.includes(`'${column}' column`) || message.includes(`.${column} does not exist`))
  )
}

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const perPage = 1000

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })

    if (error) throw error

    const user = (data.users ?? []).find((item) => item.email?.toLowerCase() === email)
    if (user) return user
    if ((data.users ?? []).length < perPage) return null
  }

  return null
}

async function saveResponsable(admin: AdminClient, payload: ResponsablePayload) {
  const fullPayload = {
    nombre: payload.fullName,
    email: payload.email,
    usuario_id: payload.userId,
    departamento: payload.departamento,
    cargo: payload.roleName,
    activo: true,
  }
  const legacyPayload = {
    nombre: payload.fullName,
    departamento: payload.departamento,
    cargo: payload.roleName,
    activo: true,
  }

  const saveLegacyResponsable = async () => {
    const { data: responsableByName, error: legacyLookupError } = await admin
      .from('responsables')
      .select('id')
      .eq('nombre', payload.fullName)
      .maybeSingle()

    if (legacyLookupError?.code === '42P01') return
    if (legacyLookupError) throw legacyLookupError

    const { error: legacySaveError } = responsableByName?.id
      ? await admin.from('responsables').update(legacyPayload).eq('id', responsableByName.id)
      : await admin.from('responsables').insert(legacyPayload)

    if (legacySaveError?.code === '42P01') return
    if (legacySaveError) throw legacySaveError
  }

  const { data: responsable, error: responsableLookupError } = await admin
    .from('responsables')
    .select('id')
    .eq('email', payload.email)
    .maybeSingle()

  if (responsableLookupError?.code === '42P01') return
  if (isMissingColumnError(responsableLookupError, ['email'])) {
    await saveLegacyResponsable()
    return
  }
  if (responsableLookupError) throw responsableLookupError

  const { error: responsableSaveError } = responsable?.id
    ? await admin.from('responsables').update(fullPayload).eq('id', responsable.id)
    : await admin.from('responsables').insert(fullPayload)

  if (responsableSaveError?.code === '42P01') return
  if (isMissingColumnError(responsableSaveError, ['email', 'usuario_id'])) {
    await saveLegacyResponsable()
    return
  }
  if (responsableSaveError) throw responsableSaveError
}

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()
    const [rolesResult, departamentosResult] = await Promise.all([
      admin.from('tipos_usuario').select('codigo, nombre, descripcion').order('nombre'),
      admin.from('departamentos').select('id, nombre, activo').eq('activo', true).order('nombre'),
    ])

    if (rolesResult.error) throw rolesResult.error
    if (departamentosResult.error && departamentosResult.error.code !== '42P01') throw departamentosResult.error

    const roles = (rolesResult.data ?? [])
      .filter((role) => isRegistrationRole(role.codigo))
      .map((role) => ({
        codigo: role.codigo,
        nombre: role.nombre,
        descripcion: role.descripcion,
      }))
    const departamentos = (departamentosResult.data ?? []).map((departamento) => ({
      id: departamento.id,
      nombre: departamento.nombre,
    }))

    return NextResponse.json({
      ok: true,
      roles: roles.length ? roles : PUBLIC_REGISTRATION_ROLES,
      departamentos: departamentos.length ? departamentos : REGISTRATION_DEPARTAMENTOS,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      ok: true,
      roles: PUBLIC_REGISTRATION_ROLES,
      departamentos: REGISTRATION_DEPARTAMENTOS,
      warning: error instanceof Error ? error.message : 'No se pudieron cargar los catalogos desde la base de datos.',
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterPayload
    const email = body.email?.trim().toLowerCase()
    const password = body.password ?? ''
    const fullName = body.fullName?.trim() || (email ? fallbackNameFromEmail(email) : '')
    const roleCode = normalizeRoleCode(body.roleCode)
    const departamento = body.departamento?.trim()

    if (!email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Correo y contrasena son obligatorios.',
        },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: 'La contrasena debe tener al menos 8 caracteres.',
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

    const admin = createAdminSupabaseClient()
    const { data: departamentoRows, error: departamentoError } = await admin
      .from('departamentos')
      .select('nombre')
      .eq('activo', true)

    if (departamentoError) throw departamentoError

    const departamentoRow = (departamentoRows ?? []).find(
      (row) => normalizeCatalogText(row.nombre) === normalizeCatalogText(departamento)
    )

    if (!departamentoRow) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecciona un departamento valido.',
        },
        { status: 400 }
      )
    }

    const { data: roleRow, error: roleError } = await admin
      .from('tipos_usuario')
      .select('id, codigo, nombre')
      .eq('codigo', roleCode)
      .maybeSingle()

    if (roleError) throw roleError

    if (!roleRow || !isRegistrationRole(roleRow.codigo)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecciona un rol valido para el usuario.',
        },
        { status: 400 }
      )
    }

    const existingUser = await findAuthUserByEmail(admin, email)
    let userId = ''

    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Ya existe una cuenta con este correo. Usa la opcion de recuperar contrasena desde el login.',
        },
        { status: 409 }
      )
    } else {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      })

      if (createError) throw createError

      userId = createdUser.user.id
    }

    const { error: profileError } = await admin.from('perfiles_usuario').upsert(
      {
        id: userId,
        email,
        nombre_completo: fullName,
        tipo_usuario_id: roleRow.id,
      },
      { onConflict: 'id' }
    )

    if (profileError) throw profileError

    await saveResponsable(admin, {
      email,
      fullName,
      userId,
      departamento: departamentoRow.nombre,
      roleName: roleRow.nombre,
    })

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        email,
        role: roleRow.nombre,
        action: 'created',
      },
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo registrar el usuario.',
      },
      { status: 500 }
    )
  }
}
