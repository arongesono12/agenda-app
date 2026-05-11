import { NextResponse } from 'next/server'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES, READER_ROLE_CODES, hasAnyRole } from '@/lib/access-control'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

type CatalogResource = 'departamentos' | 'responsables'

type CatalogPayload = {
  resource?: CatalogResource
  id?: number
  nombre?: string
  email?: string
  departamento?: string | null
  cargo?: string | null
}

function readResource(url: URL): CatalogResource | 'all' {
  const resource = url.searchParams.get('resource')
  if (resource === 'departamentos' || resource === 'responsables') return resource
  return 'all'
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()
  return email || null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

type ResponsableCatalogRow = {
  id: number
  nombre: string
  email: string | null
  usuario_id: string | null
  departamento: string | null
  cargo: string | null
  activo: boolean | null
  created_at: string | null
}

type ProfileRoleRow = {
  id: string
  tipo_usuario?: { codigo?: string | null } | Array<{ codigo?: string | null }> | null
}

function readRoleCode(profile: ProfileRoleRow) {
  const role = Array.isArray(profile.tipo_usuario) ? profile.tipo_usuario[0] : profile.tipo_usuario
  return role?.codigo?.trim().toLowerCase() ?? ''
}

async function filterAssignableResponsables(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  rows: ResponsableCatalogRow[],
  options: { roleCodes?: string[]; departamento?: string | null } = {}
) {
  const allowedRoles = options.roleCodes?.length
    ? new Set(options.roleCodes.map((role) => role.trim().toLowerCase()))
    : null
  const adminRoles = new Set(ADMIN_ROLE_CODES)
  const departamento = options.departamento?.trim().toLowerCase()
  const userIds = Array.from(
    new Set(
      rows
        .filter((row) => row.activo ?? true)
        .filter((row) => !departamento || row.departamento?.trim().toLowerCase() === departamento)
        .map((row) => row.usuario_id)
        .filter((value): value is string => !!value)
    )
  )

  if (userIds.length === 0) return []

  const { data, error } = await admin
    .from('perfiles_usuario')
    .select('id, tipo_usuario:tipos_usuario(codigo)')
    .in('id', userIds)

  if (error) throw error

  const assignableUserIds = new Set(
    ((data ?? []) as ProfileRoleRow[])
      .filter((profile) => {
        const roleCode = readRoleCode(profile)
        if (!roleCode || adminRoles.has(roleCode as (typeof ADMIN_ROLE_CODES)[number])) return false
        return allowedRoles ? allowedRoles.has(roleCode) : true
      })
      .map((profile) => profile.id)
  )
  const roleByUserId = new Map(
    ((data ?? []) as ProfileRoleRow[]).map((profile) => [profile.id, readRoleCode(profile)])
  )

  return rows
    .filter((row) => {
      if (!row.usuario_id || !assignableUserIds.has(row.usuario_id)) return false
      return !departamento || row.departamento?.trim().toLowerCase() === departamento
    })
    .map((row) => ({
      ...row,
      tipo_usuario_codigo: row.usuario_id ? roleByUserId.get(row.usuario_id) ?? null : null,
    }))
}

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, READER_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar catalogos.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const resource = readResource(url)
    const onlyAssignable = url.searchParams.get('assignable') === 'true'
    const roleFilter = url.searchParams.get('role')?.trim().toLowerCase()
    const departamentoFilter = url.searchParams.get('departamento')
    const admin = createAdminSupabaseClient()
    const result: Record<string, unknown> = {}

    if (resource === 'all' || resource === 'departamentos') {
      const { data, error } = await admin
        .from('departamentos')
        .select('id, nombre, activo, created_at')
        .order('nombre')

      if (error) throw error
      result.departamentos = data ?? []
    }

    if (resource === 'all' || resource === 'responsables') {
      if (!hasAnyRole(profile, MANAGER_ROLE_CODES)) {
        result.responsables = []
      } else {
        const { data, error } = await admin
          .from('responsables')
          .select('id, nombre, email, usuario_id, departamento, cargo, activo, created_at')
          .order('nombre')

        if (error) throw error
        const rows = (data ?? []) as ResponsableCatalogRow[]
        result.responsables = onlyAssignable
          ? await filterAssignableResponsables(admin, rows, {
              roleCodes: roleFilter ? [roleFilter] : undefined,
              departamento: departamentoFilter,
            })
          : rows
      }
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudieron consultar los catalogos.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, ADMIN_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden modificar catalogos.' }, { status: 403 })
    }

    const payload = (await request.json()) as CatalogPayload
    const admin = createAdminSupabaseClient()

    if (payload.resource === 'departamentos') {
      const nombre = payload.nombre?.trim()
      if (!nombre) {
        return NextResponse.json({ ok: false, error: 'El nombre del departamento es obligatorio.' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('departamentos')
        .insert({ nombre })
        .select('id, nombre, activo, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ ok: true, item: data })
    }

    if (payload.resource === 'responsables') {
      const nombre = payload.nombre?.trim()
      const email = normalizeEmail(payload.email)

      if (!nombre) {
        return NextResponse.json({ ok: false, error: 'El nombre del responsable es obligatorio.' }, { status: 400 })
      }

      if (!email || !isValidEmail(email)) {
        return NextResponse.json({ ok: false, error: 'Introduce un correo valido para el responsable.' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('responsables')
        .insert({
          nombre,
          email,
          departamento: payload.departamento || null,
          cargo: payload.cargo || null,
          activo: true,
        })
        .select('id, nombre, email, usuario_id, departamento, cargo, activo, created_at')
        .single()

      if (error) throw error
      return NextResponse.json({ ok: true, item: data })
    }

    return NextResponse.json({ ok: false, error: 'Catalogo no soportado.' }, { status: 400 })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar el catalogo.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, ADMIN_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden eliminar catalogos.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const resource = url.searchParams.get('resource')
    const id = Number(url.searchParams.get('id'))

    if ((resource !== 'departamentos' && resource !== 'responsables') || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Debes indicar catalogo e identificador validos.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { error } = await admin.from(resource).delete().eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar el catalogo.' },
      { status: 500 }
    )
  }
}
