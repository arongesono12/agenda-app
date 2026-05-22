import { NextResponse } from 'next/server'
import { crearInstruccionesTransferencia, generarReferenciaTransferencia, type BankTransferIntervalo } from '@/lib/billing/bank-transfer'
import { getPlan } from '@/lib/billing/plans'
import { esOrganismoSegesa, resolverRolActivo } from '@/lib/organismo-access'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getServerSessionProfile } from '@/lib/server-access'
import type { PlanCodigo } from '@/lib/types'

export const dynamic = 'force-dynamic'

type BankTransferPayload = {
  organismoId?: string
  planCodigo?: PlanCodigo
  intervalo?: BankTransferIntervalo
}

function isMissingPaymentColumns(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /metodo_pago|referencia_pago|notas_pago|schema cache|column .* does not exist/i.test(message)
  )
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export async function POST(request: Request) {
  try {
    const { user } = await getServerSessionProfile()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 })

    const body = (await request.json()) as BankTransferPayload
    const { organismoId, planCodigo, intervalo = 'mensual' } = body

    if (!organismoId || !planCodigo) {
      return NextResponse.json({ ok: false, error: 'Faltan parametros para generar la transferencia.' }, { status: 400 })
    }

    if (planCodigo === 'individual') {
      return NextResponse.json({ ok: false, error: 'El plan individual no requiere transferencia.' }, { status: 400 })
    }

    if (esOrganismoSegesa(organismoId)) {
      return NextResponse.json({ ok: false, error: 'El organo Segesa esta exento de pagos.' }, { status: 400 })
    }

    const plan = getPlan(planCodigo)
    if (!plan || plan.codigo === 'individual') {
      return NextResponse.json({ ok: false, error: 'Selecciona un plan de pago valido.' }, { status: 400 })
    }

    const admin = createAdminSupabaseClient()
    const rol = await resolverRolActivo(admin, user.id, organismoId)
    if (!rol || !ADMIN_ROLE_CODES.includes(rol as (typeof ADMIN_ROLE_CODES)[number])) {
      return NextResponse.json({ ok: false, error: 'Solo administradores pueden iniciar pagos.' }, { status: 403 })
    }

    const { data: organismo, error: organismoError } = await admin
      .from('organismos')
      .select('id, nombre, slug')
      .eq('id', organismoId)
      .maybeSingle()

    if (organismoError) throw organismoError
    if (!organismo) return NextResponse.json({ ok: false, error: 'Organismo no encontrado.' }, { status: 404 })

    const referencia = generarReferenciaTransferencia(organismo.slug)
    const instrucciones = crearInstruccionesTransferencia({
      referencia,
      planCodigo,
      intervalo,
      organismoNombre: organismo.nombre,
    })

    const subscriptionPayload = {
      plan_codigo: planCodigo,
      estado: 'prueba',
      periodo_inicio: new Date().toISOString(),
      trial_fin: addDays(7),
      metodo_pago: 'transferencia_bancaria',
      referencia_pago: referencia,
      updated_at: new Date().toISOString(),
    }

    const subUpdate = await admin
      .from('organismo_suscripciones')
      .update(subscriptionPayload as never)
      .eq('organismo_id', organismoId)

    if (subUpdate.error) {
      if (!isMissingPaymentColumns(subUpdate.error)) throw subUpdate.error
      const { metodo_pago, referencia_pago, ...legacySubscriptionPayload } = subscriptionPayload
      void metodo_pago
      void referencia_pago
      const legacySubUpdate = await admin
        .from('organismo_suscripciones')
        .update(legacySubscriptionPayload)
        .eq('organismo_id', organismoId)
      if (legacySubUpdate.error) throw legacySubUpdate.error
    }

    const facturaPayload = {
      organismo_id: organismoId,
      stripe_invoice_id: `bank_transfer:${referencia}`,
      importe_centimos: instrucciones.importeCentimos,
      moneda: instrucciones.moneda.toLowerCase(),
      estado: 'pendiente',
      fecha_emision: new Date().toISOString(),
      fecha_vencimiento: instrucciones.vencimiento,
      metodo_pago: 'transferencia_bancaria',
      referencia_pago: referencia,
      notas_pago: `Concepto: ${instrucciones.concepto}`,
    }

    const facturaInsert = await admin
      .from('organismo_facturas')
      .insert(facturaPayload as never)
      .select('id')
      .maybeSingle()

    if (facturaInsert.error) {
      if (!isMissingPaymentColumns(facturaInsert.error)) throw facturaInsert.error
      const { metodo_pago, referencia_pago, notas_pago, ...legacyFacturaPayload } = facturaPayload
      void metodo_pago
      void referencia_pago
      void notas_pago
      const legacyFacturaInsert = await admin
        .from('organismo_facturas')
        .insert(legacyFacturaPayload)
        .select('id')
        .maybeSingle()
      if (legacyFacturaInsert.error) throw legacyFacturaInsert.error
    }

    return NextResponse.json({
      ok: true,
      metodo: 'transferencia_bancaria',
      instrucciones,
      redirect: `/organismos/${organismo.slug}/dashboard`,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No se pudo generar la transferencia bancaria.' },
      { status: 500 }
    )
  }
}
