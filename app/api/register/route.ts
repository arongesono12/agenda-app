import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

type RegisterPayload = {
  email?: string
  password?: string
  fullName?: string
  roleCode?: string
  departamento?: string
}

function fallbackNameFromEmail(email: string) {
  return email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || email
}

function normalizeRoleCode(value?: string) {
  return value?.trim().toLowerCase() || 'responsable'
}

function isPublicRole(roleCode?: string | null) {
  const normalizedRole = roleCode?.trim().toLowerCase()
  return !!normalizedRole && normalizedRole !== 'administrador' && normalizedRole !== 'administradora'
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
      .filter((role) => isPublicRole(role.codigo))
      .map((role) => ({
        codigo: role.codigo,
        nombre: role.nombre,
        descripcion: role.descripcion,
      }))
    const departamentos = (departamentosResult.data ?? []).map((departamento) => ({
      id: departamento.id,
      nombre: departamento.nombre,
    }))

    return NextResponse.json({ ok: true, roles, departamentos })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudieron cargar los roles.',
      },
      { status: 500 }
    )
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
    const { data: departamentoRow, error: departamentoError } = await admin
      .from('departamentos')
      .select('nombre')
      .eq('nombre', departamento)
      .eq('activo', true)
      .maybeSingle()

    if (departamentoError) throw departamentoError

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

    if (!roleRow || !isPublicRole(roleRow.codigo)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Selecciona un rol valido. Los roles de administrador no se pueden crear desde el registro publico.',
        },
        { status: 400 }
      )
    }

    const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (listError) throw listError

    const existingUser = (listedUsers.users ?? []).find((user) => user.email?.toLowerCase() === email)

    if (existingUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Ya existe un usuario con este correo. Inicia sesion o pide restablecer la contrasena.',
        },
        { status: 409 }
      )
    }

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    })

    if (createError) throw createError

    const userId = createdUser.user.id

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
        nombre: fullName,
        email,
        usuario_id: userId,
        departamento: departamentoRow.nombre,
        cargo: roleRow.nombre,
        activo: true,
      }

      const { error: responsableSaveError } = responsable?.id
        ? await admin.from('responsables').update(responsablePayload).eq('id', responsable.id)
        : await admin.from('responsables').insert(responsablePayload)

      if (responsableSaveError) throw responsableSaveError
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        email,
        role: roleRow.nombre,
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
