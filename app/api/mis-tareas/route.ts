import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'

export const dynamic = 'force-dynamic'

type PersonalTaskPayload = {
  id?: number
  titulo?: string
  descripcion?: string | null
  fecha?: string | null
  completada?: boolean
}

type PersonalTaskUpdate = {
  titulo?: string
  descripcion?: string | null
  fecha?: string | null
  completada?: boolean
  completada_at?: string | null
}

function normalizeDate(value?: string | null) {
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function GET(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    const q = url.searchParams.get('q')?.trim()

    const admin = createAdminSupabaseClient()
    let query = admin
      .from('mis_tareas')
      .select('id, titulo, descripcion, fecha, completada, completada_at, created_at, updated_at')
      .eq('usuario_id', user.id)
      .order('completada', { ascending: true })
      .order('fecha', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (estado === 'pendientes') query = query.eq('completada', false)
    if (estado === 'completadas') query = query.eq('completada', true)
    if (q) {
      const safeQuery = q.replace(/[%,()]/g, ' ').trim()
      if (safeQuery) query = query.or(`titulo.ilike.%${safeQuery}%,descripcion.ilike.%${safeQuery}%`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true, tareas: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al cargar tus tareas.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as PersonalTaskPayload
    const titulo = body.titulo?.trim()

    if (!titulo || titulo.length > 180) {
      return NextResponse.json({ ok: false, error: 'El titulo es obligatorio y debe tener maximo 180 caracteres.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('mis_tareas')
      .insert({
        usuario_id: user.id,
        titulo,
        descripcion: body.descripcion?.trim() || null,
        fecha: normalizeDate(body.fecha),
      })
      .select('id, titulo, descripcion, fecha, completada, completada_at, created_at, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, tarea: data })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear la tarea.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as PersonalTaskPayload
    if (!Number.isInteger(body.id) || Number(body.id) <= 0) {
      return NextResponse.json({ ok: false, error: 'ID invalido.' }, { status: 400 })
    }
    const taskId = Number(body.id)

    const updates: PersonalTaskUpdate = {}
    if (typeof body.titulo === 'string') {
      const titulo = body.titulo.trim()
      if (!titulo || titulo.length > 180) {
        return NextResponse.json({ ok: false, error: 'El titulo es obligatorio y debe tener maximo 180 caracteres.' }, { status: 400 })
      }
      updates.titulo = titulo
    }
    if ('descripcion' in body) updates.descripcion = body.descripcion?.trim() || null
    if ('fecha' in body) updates.fecha = normalizeDate(body.fecha)
    if (typeof body.completada === 'boolean') {
      updates.completada = body.completada
      updates.completada_at = body.completada ? new Date().toISOString() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No hay cambios para guardar.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { data, error } = await admin
      .from('mis_tareas')
      .update(updates)
      .eq('id', taskId)
      .eq('usuario_id', user.id)
      .select('id, titulo, descripcion, fecha, completada, completada_at, created_at, updated_at')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ ok: false, error: 'Tarea no encontrada.' }, { status: 404 })

    return NextResponse.json({ ok: true, tarea: data })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo actualizar la tarea.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'ID invalido.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const { error } = await admin
      .from('mis_tareas')
      .delete()
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo eliminar la tarea.' },
      { status: 500 }
    )
  }
}
