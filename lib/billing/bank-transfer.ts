import { getPlan } from '@/lib/billing/plans'
import type { PlanCodigo } from '@/lib/types'

export type BankTransferIntervalo = 'mensual' | 'anual'

export type BankTransferInstructions = {
  referencia: string
  importeCentimos: number
  moneda: string
  beneficiario: string
  banco: string
  cuenta: string
  iban?: string | null
  swift?: string | null
  concepto: string
  vencimiento: string
}

function cleanReferencePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase()
}

export function calcularImporteTransferencia(planCodigo: PlanCodigo, intervalo: BankTransferIntervalo) {
  const plan = getPlan(planCodigo)
  const precio = intervalo === 'anual' ? plan.precioAnual : plan.precioMensual
  return Math.max(0, Math.round(precio * 100))
}

export function generarReferenciaTransferencia(organismoSlug: string) {
  const slugPart = cleanReferencePart(organismoSlug) || 'ORG'
  const timePart = Date.now().toString(36).toUpperCase()
  return `TRF-${slugPart}-${timePart}`
}

export function crearInstruccionesTransferencia(params: {
  referencia: string
  planCodigo: PlanCodigo
  intervalo: BankTransferIntervalo
  organismoNombre: string
}): BankTransferInstructions {
  const vencimiento = new Date()
  vencimiento.setDate(vencimiento.getDate() + 7)

  return {
    referencia: params.referencia,
    importeCentimos: calcularImporteTransferencia(params.planCodigo, params.intervalo),
    moneda: process.env.BANK_TRANSFER_CURRENCY || 'EUR',
    beneficiario: process.env.BANK_TRANSFER_ACCOUNT_NAME || 'Control Automatizado Agenda',
    banco: process.env.BANK_TRANSFER_BANK_NAME || 'Banco pendiente de configurar',
    cuenta: process.env.BANK_TRANSFER_ACCOUNT_NUMBER || 'Cuenta pendiente de configurar',
    iban: process.env.BANK_TRANSFER_IBAN || null,
    swift: process.env.BANK_TRANSFER_SWIFT || null,
    concepto: `${params.referencia} - ${params.organismoNombre}`,
    vencimiento: vencimiento.toISOString(),
  }
}
