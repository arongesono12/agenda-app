import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import {
  crearOrganismo,
  agregarMiembro,
  generarSlug,
  listarOrganismosDeUsuario,
  ORGANISMO_COOKIE,
} from '@/lib/organismo-access'
import type { PlanCodigo } from '@/lib/types'
import { SEGESA_ORGANISMO_ID } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const admin = createAdminSupabaseClient()
    const organismos = await listarOrganismosDeUsuario(admin, user.id)

    return NextResponse.json({ ok: true, organismos })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error al obtener organismos.' },
      { status: 500 }
    )
  }
}

type CrearOrganismoPayload = {
  nombre?: string
  tipo?: 'individual' | 'corporativo'
  sector?: string
  pais?: string
  planCodigo?: PlanCodigo
  intervalo?: 'mensual' | 'anual'
}

export async function POST(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as CrearOrganismoPayload
    const nombre = body.nombre?.trim()
    const tipo = body.tipo ?? 'corporativo'
    const planCodigo = body.planCodigo ?? 'individual'

    if (!nombre || nombre.length < 2) {
      return NextResponse.json({ ok: false, error: 'El nombre del organismo es obligatorio.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()

    // Generar slug único
    let slug = generarSlug(nombre)
    const { data: existingSlug } = await admin
      .from('organismos')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    // Crear organismo
    const organismo = await crearOrganismo(admin, {
      nombre,
      slug,
      tipo,
      sector: body.sector,
      pais: body.pais ?? 'ES',
      creadoPor: user.id,
    })

    // Añadir creador como administrador
    await agregarMiembro(admin, organismo.id, user.id, 'administrador')

    // Crear suscripción inicial
    if (planCodigo === 'individual') {
      await admin.from('organismo_suscripciones').insert({
        organismo_id: organismo.id,
        plan_codigo: 'individual',
        estado: 'activa',
      })

      const response = NextResponse.json({
        ok: true,
        organismo,
        redirect: `/organismos/${organismo.slug}/dashboard`,
      })
      response.cookies.set(ORGANISMO_COOKIE, organismo.id, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
      return response
    }

    // Para planes de pago, devolver organismo y dejar que el cliente lance checkout
    await admin.from('organismo_suscripciones').insert({
      organismo_id: organismo.id,
      plan_codigo: planCodigo,
      estado: 'prueba',
    })

    const response = NextResponse.json({
      ok: true,
      organismo,
      planCodigo,
      intervalo: body.intervalo ?? 'mensual',
      redirect: null,
    })
    response.cookies.set(ORGANISMO_COOKIE, organismo.id, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear el organismo.' },
      { status: 500 }
    )
  }
}

export { SEGESA_ORGANISMO_ID }
