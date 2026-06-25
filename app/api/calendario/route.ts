import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import { getOrganismoIdFromRequest, getRoleCodeFromRequest, getServerSessionProfile } from '@/lib/server-access'
import type { CalendarioColor, CalendarioTipoEvento } from '@/lib/types'

export const dynamic = 'force-dynamic'

const TIPO_EVENTOS: CalendarioTipoEvento[] = ['festivo', 'evento', 'actividad', 'aviso', 'fecha_limite']
const COLORES: CalendarioColor[] = ['teal', 'sky', 'amber', 'rose', 'violet', 'slate']

type CalendarEventBody = {
  id?: string
  titulo?: string
  descripcion?: string | null
  tipo_evento?: CalendarioTipoEvento
  fecha_inicio?: string
  fecha_fin?: string | null
  es_festivo?: boolean
  color?: CalendarioColor
}

function isAdminRole(roleCode: string) {
  return ADMIN_ROLE_CODES.includes(roleCode as (typeof ADMIN_ROLE_CODES)[number])
}

function normalizeDateOnly(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return trimmed
}

function monthRange(monthParam: string | null) {
  const now = new Date()
  const match = monthParam?.match(/^(\d{4})-(\d{2})$/)
  const year = match ? Number(match[1]) : now.getFullYear()
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth()
  const start = new Date(Date.UTC(year, monthIndex, 1))
  const end = new Date(Date.UTC(year, monthIndex + 1, 0))
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function validateEventBody(body: CalendarEventBody) {
  const titulo = body.titulo?.trim()
  const fechaInicio = normalizeDateOnly(body.fecha_inicio)
  const fechaFin = normalizeDateOnly(body.fecha_fin)
  const tipoEvento = body.tipo_evento ?? (body.es_festivo ? 'festivo' : 'evento')
  const color = body.color ?? (tipoEvento === 'festivo' ? 'rose' : 'teal')

  if (!titulo) throw new Error('El titulo es obligatorio.')
  if (!fechaInicio) throw new Error('La fecha de inicio es obligatoria.')
  if (body.fecha_fin && !fechaFin) throw new Error('La fecha de fin no es valida.')
  if (fechaFin && fechaFin < fechaInicio) throw new Error('La fecha de fin debe ser igual o posterior al inicio.')
  if (!TIPO_EVENTOS.includes(tipoEvento)) throw new Error('El tipo de evento no es valido.')
  if (!COLORES.includes(color)) throw new Error('El color seleccionado no es valido.')

  return {
    titulo,
    descripcion: body.descripcion?.trim() || null,
    tipo_evento: tipoEvento,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    es_festivo: tipoEvento === 'festivo' ? true : !!body.es_festivo,
    color,
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const organismoId = getOrganismoIdFromRequest(request)
    if (!organismoId) return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })

    const url = new URL(request.url)
    const requestedFrom = normalizeDateOnly(url.searchParams.get('from'))
    const requestedTo = normalizeDateOnly(url.searchParams.get('to'))
    const fallbackRange = monthRange(url.searchParams.get('month'))
    const from = requestedFrom ?? fallbackRange.from
    const to = requestedTo ?? fallbackRange.to

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('calendario_eventos')
      .select('*')
      .eq('organismo_id', organismoId)
      .lte('fecha_inicio', to)
      .or(`fecha_fin.is.null,fecha_fin.gte.${from}`)
      .order('fecha_inicio', { ascending: true })
      .order('titulo', { ascending: true })

    if (error) throw error
    return NextResponse.json({ ok: true, eventos: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo cargar el calendario.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    if (!organismoId) return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    if (!isAdminRole(activeRoleCode)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden crear eventos del calendario.' }, { status: 403 })
    }

    const body = (await request.json()) as CalendarEventBody
    const payload = validateEventBody(body)
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('calendario_eventos')
      .insert({
        ...payload,
        organismo_id: organismoId,
        creado_por_usuario_id: user.id,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, evento: data })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear el evento.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    if (!organismoId) return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    if (!isAdminRole(activeRoleCode)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden editar eventos del calendario.' }, { status: 403 })
    }

    const body = (await request.json()) as CalendarEventBody
    if (!body.id) return NextResponse.json({ ok: false, error: 'Falta el identificador del evento.' }, { status: 400 })

    const payload = validateEventBody(body)
    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('calendario_eventos')
      .update(payload)
      .eq('id', body.id)
      .eq('organismo_id', organismoId)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, evento: data })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar el evento.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, profile } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const organismoId = getOrganismoIdFromRequest(request)
    const activeRoleCode = getRoleCodeFromRequest(request, profile)
    if (!organismoId) return NextResponse.json({ ok: false, error: 'Falta el organismo activo.' }, { status: 400 })
    if (!isAdminRole(activeRoleCode)) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden eliminar eventos del calendario.' }, { status: 403 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'Falta el identificador del evento.' }, { status: 400 })

    const admin = createAdminSupabaseClient()
    const { error } = await admin
      .from('calendario_eventos')
      .delete()
      .eq('id', id)
      .eq('organismo_id', organismoId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar el evento.' },
      { status: 500 }
    )
  }
}
