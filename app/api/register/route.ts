import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { ORGANISMO_COOKIE } from '@/lib/organismo-access'
import { PUBLIC_REGISTRATION_ROLE_CODES, PUBLIC_REGISTRATION_ROLES, REGISTRATION_DEPARTAMENTOS } from '@/lib/registration-options'
import { SEGESA_ORGANISMO_ID } from '@/lib/types'

export const dynamic = 'force-dynamic'

type RegisterPayload = {
  email?: string
  password?: string
  fullName?: string
  roleCode?: string
  departamento?: string
  organismoId?: string
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

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

function isSegesaEmail(email: string) {
  return email.trim().toLowerCase().endsWith('@segesa.gq')
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

async function loadDepartamentosRegistro(admin: AdminClient, selectColumns: string) {
  const scoped = await admin
    .from('departamentos')
    .select(selectColumns)
    .eq('activo', true)
    .eq('organismo_id', SEGESA_ORGANISMO_ID)
    .order('nombre')

  if (!isMissingColumnError(scoped.error, ['organismo_id'])) return scoped

  return admin
    .from('departamentos')
    .select(selectColumns)
    .eq('activo', true)
    .order('nombre')
}

async function loadOrganismosRegistro(admin: AdminClient) {
  const result = await admin
    .from('organismos')
    .select('id, nombre, slug, activo')
    .eq('activo', true)
    .order('nombre')

  if (result.error && result.error.code !== '42P01' && result.error.code !== 'PGRST205') throw result.error

  return result.error ? [] : (result.data ?? [])
}

export async function GET() {
  try {
    const admin = createAdminSupabaseClient()
    const [rolesResult, departamentosResult, organismos] = await Promise.all([
      admin.from('tipos_usuario').select('codigo, nombre, descripcion').order('nombre'),
      loadDepartamentosRegistro(admin, 'id, nombre, activo'),
      loadOrganismosRegistro(admin),
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
    const departamentos = ((departamentosResult.data ?? []) as unknown as Array<{ id: number; nombre: string }>).map((departamento) => ({
      id: departamento.id,
      nombre: departamento.nombre,
    }))

    return NextResponse.json({
      ok: true,
      roles: roles.length ? roles : PUBLIC_REGISTRATION_ROLES,
      departamentos: departamentos.length ? departamentos : REGISTRATION_DEPARTAMENTOS,
      organismos: organismos.map((organismo) => ({
        id: organismo.id,
        nombre: organismo.nombre,
        slug: organismo.slug,
      })),
    })
  } catch (error: unknown) {
    return NextResponse.json({
      ok: true,
      roles: PUBLIC_REGISTRATION_ROLES,
      departamentos: REGISTRATION_DEPARTAMENTOS,
      organismos: [],
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
    const requestedOrganismoId = body.organismoId?.trim() || null

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
    const targetOrganismoId = email && isSegesaEmail(email) ? SEGESA_ORGANISMO_ID : requestedOrganismoId

    let targetOrganismo: { id: string; slug: string | null } | null = null

    if (targetOrganismoId) {
      const { data: organismoRow, error: organismoError } = await admin
        .from('organismos')
        .select('id, slug, activo')
        .eq('id', targetOrganismoId)
        .eq('activo', true)
        .maybeSingle()

      if (organismoError) throw organismoError

      if (!organismoRow) {
        return NextResponse.json(
          {
            ok: false,
            error: email && isSegesaEmail(email)
              ? 'El organo de Segesa no esta configurado. Ejecuta el script SQL de organismos antes de registrar usuarios de Segesa.'
              : 'Selecciona un organo valido.',
          },
          { status: 400 }
        )
      }

      targetOrganismo = organismoRow
    }

    const { data: departamentoRows, error: departamentoError } = await loadDepartamentosRegistro(admin, 'nombre')

    if (departamentoError) throw departamentoError

    const departamentoRow = ((departamentoRows ?? []) as unknown as Array<{ nombre: string }>).find(
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

    if (targetOrganismoId) {
      const { error: memberError } = await admin.from('organismo_miembros').upsert(
        {
          organismo_id: targetOrganismoId,
          usuario_id: userId,
          rol_codigo: roleRow.codigo,
          activo: true,
        },
        { onConflict: 'organismo_id,usuario_id' }
      )

      if (memberError) throw memberError
    }

    void departamentoRow

    const redirect = targetOrganismoId ? '/dashboard' : '/organismos/nuevo'

    const response = NextResponse.json({
      ok: true,
      redirect,
      user: {
        id: userId,
        email,
        role: roleRow.nombre,
        action: 'created',
      },
    })

    if (targetOrganismo?.id) {
      response.cookies.set(ORGANISMO_COOKIE, targetOrganismo.id, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    return response
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
