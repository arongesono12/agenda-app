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

export async function GET(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()

    if (!user || !hasAnyRole(profile, READER_ROLE_CODES)) {
      return NextResponse.json({ ok: false, error: 'No tienes permiso para consultar catalogos.' }, { status: 403 })
    }

    const url = new URL(request.url)
    const resource = readResource(url)
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
        result.responsables = data ?? []
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
