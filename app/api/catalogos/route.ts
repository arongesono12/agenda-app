import { NextResponse } from 'next/server'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES, READER_ROLE_CODES } from '@/lib/access-control'
import { PUBLIC_REGISTRATION_ROLE_CODES } from '@/lib/registration-options'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile, getOrganismoIdFromRequest, getRoleCodeFromRequest } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

type CatalogResource = 'departamentos' | 'responsables'

type CatalogPayload = {
  resource?: CatalogResource
  id?: number
  nombre?: string
  email?: string
  departamento?: string | null
  cargo?: string | null
  roleCode?: string | null
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
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !READER_ROLE_CODES.includes(activeRoleCode as (typeof READER_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar catalogos.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const resource = readResource(url)
    const onlyAssignable = url.searchParams.get('assignable') === 'true'
    const roleFilter = url.searchParams.get('role')?.trim().toLowerCase()
    const departamentoFilter = url.searchParams.get('departamento')
    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const result: Record<string, unknown> = {}

    if (resource === 'all' || resource === 'departamentos') {
      let deptQuery = admin
        .from('departamentos')
        .select('id, nombre, activo, created_at')
        .order('nombre')
      if (organismoId) deptQuery = deptQuery.eq('organismo_id', organismoId)
      const { data, error } = await deptQuery

      if (error) throw error
      result.departamentos = data ?? []
    }

    if (resource === 'all' || resource === 'responsables') {
      if (!MANAGER_ROLE_CODES.includes(activeRoleCode as (typeof MANAGER_ROLE_CODES)[number])) {
        result.responsables = []
      } else {
        let respQuery = admin
          .from('responsables')
          .select('id, nombre, email, usuario_id, departamento, cargo, activo, created_at')
          .order('nombre')
        if (organismoId) respQuery = respQuery.eq('organismo_id', organismoId)
        const { data, error } = await respQuery

        if (error) throw error
        const rows = (data ?? []) as ResponsableCatalogRow[]

        if (onlyAssignable) {
          result.responsables = await filterAssignableResponsables(admin, rows, {
            roleCodes: roleFilter ? [roleFilter] : undefined,
            departamento: departamentoFilter,
          })
        } else {
          const userIds = rows.map((r) => r.usuario_id).filter((id): id is string => !!id)
          let avatarMap = new Map<string, string | null>()

          if (userIds.length > 0) {
            const { data: profiles } = await admin
              .from('perfiles_usuario')
              .select('id, avatar_url, tipo_usuario:tipos_usuario(codigo)')
              .in('id', userIds)
            avatarMap = new Map((profiles ?? []).map((p) => [p.id as string, (p.avatar_url as string | null) ?? null]))
            const roleMap = new Map(
              ((profiles ?? []) as Array<{
                id: string
                tipo_usuario?: { codigo?: string | null } | Array<{ codigo?: string | null }> | null
              }>).map((p) => [p.id, readRoleCode(p)])
            )

            result.responsables = rows.map((r) => ({
              ...r,
              avatar_url: r.usuario_id ? (avatarMap.get(r.usuario_id) ?? null) : null,
              tipo_usuario_codigo: r.usuario_id ? (roleMap.get(r.usuario_id) ?? null) : null,
            }))
          } else {
            result.responsables = rows.map((r) => ({
              ...r,
              avatar_url: null,
              tipo_usuario_codigo: null,
            }))
          }
        }
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
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden modificar catalogos.' }, { status: 403 })
    }

    const payload = (await request.json()) as CatalogPayload
    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)

    if (payload.resource === 'departamentos') {
      const nombre = payload.nombre?.trim()
      if (!nombre) {
        return NextResponse.json({ ok: false, error: 'El nombre del departamento es obligatorio.' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('departamentos')
        .insert({ nombre, ...(organismoId ? { organismo_id: organismoId } : {}) })
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
          ...(organismoId ? { organismo_id: organismoId } : {}),
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

export async function PATCH(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json(
        { ok: false, error: 'Solo administradores pueden cambiar el departamento o rol de un responsable.' },
        { status: 403 }
      )
    }

    const payload = (await request.json()) as { id?: number; departamento?: string | null; roleCode?: string | null }
    const id = Number(payload.id)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'ID de responsable no valido.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    const updatePayload: { departamento?: string | null } = {}

    if ('departamento' in payload) {
      updatePayload.departamento = payload.departamento?.trim() || null
    }

    if (Object.keys(updatePayload).length > 0) {
      let updateQuery = admin
        .from('responsables')
        .update(updatePayload)
        .eq('id', id)
      if (organismoId) updateQuery = updateQuery.eq('organismo_id', organismoId)

      const { error } = await updateQuery

      if (error) throw error
    }

    if (payload.roleCode !== undefined) {
      const roleCode = payload.roleCode?.trim().toLowerCase()

      if (!roleCode || !PUBLIC_REGISTRATION_ROLE_CODES.includes(roleCode)) {
        return NextResponse.json({ ok: false, error: 'Selecciona un rol valido.' }, { status: 400 })
      }

      const { data: role, error: roleError } = await admin
        .from('tipos_usuario')
        .select('id')
        .eq('codigo', roleCode)
        .maybeSingle()

      if (roleError) throw roleError
      if (!role) {
        return NextResponse.json({ ok: false, error: 'El rol seleccionado no existe en la base de datos.' }, { status: 400 })
      }

      let responsableQuery = admin
        .from('responsables')
        .select('id, email, usuario_id')
        .eq('id', id)
      if (organismoId) responsableQuery = responsableQuery.eq('organismo_id', organismoId)
      const { data: responsable, error: responsableError } = await responsableQuery.maybeSingle()

      if (responsableError) throw responsableError
      if (!responsable) {
        return NextResponse.json({ ok: false, error: 'Responsable no encontrado.' }, { status: 404 })
      }

      let userId = responsable.usuario_id

      if (!userId && responsable.email) {
        const { data: profile, error: profileLookupError } = await admin
          .from('perfiles_usuario')
          .select('id')
          .eq('email', responsable.email.trim().toLowerCase())
          .maybeSingle()

        if (profileLookupError) throw profileLookupError
        userId = profile?.id ?? null

        if (userId) {
          let linkQuery = admin
            .from('responsables')
            .update({ usuario_id: userId })
            .eq('id', id)
          if (organismoId) linkQuery = linkQuery.eq('organismo_id', organismoId)
          const { error: linkError } = await linkQuery

          if (linkError) throw linkError
        }
      }

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'El responsable debe tener un usuario asociado antes de cambiar su rol.' },
          { status: 400 }
        )
      }

      const { error: profileUpdateError } = await admin
        .from('perfiles_usuario')
        .update({ tipo_usuario_id: role.id })
        .eq('id', userId)

      if (profileUpdateError) throw profileUpdateError
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar el departamento.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    const activeRoleCode = getRoleCodeFromRequest(request, profile)

    if (!user || !ADMIN_ROLE_CODES.includes(activeRoleCode as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden eliminar catalogos.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const resource = url.searchParams.get('resource')
    const id = Number(url.searchParams.get('id'))

    if ((resource !== 'departamentos' && resource !== 'responsables') || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Debes indicar catalogo e identificador validos.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const organismoId = getOrganismoIdFromRequest(request)
    let deleteQuery = admin.from(resource).delete().eq('id', id)
    if (organismoId) deleteQuery = deleteQuery.eq('organismo_id', organismoId)
    const { error } = await deleteQuery

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar el catalogo.' },
      { status: 500 }
    )
  }
}
