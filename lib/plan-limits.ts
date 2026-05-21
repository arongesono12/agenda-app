import type { PlanCodigo, OrganismoSuscripcion } from '@/lib/types'
import { esOrganismoSegesa } from '@/lib/organismo-access'

export interface LimitePlan {
  usuarios: number
  tareas: number
  historialDias: number
  alertasEmail: boolean
  exportarDatos: boolean
  apiExterna: boolean
}

export const LIMITES_POR_PLAN: Record<PlanCodigo, LimitePlan> = {
  individual: {
    usuarios: 1,
    tareas: 50,
    historialDias: 90,
    alertasEmail: false,
    exportarDatos: false,
    apiExterna: false,
  },
  basico: {
    usuarios: 5,
    tareas: 200,
    historialDias: 365,
    alertasEmail: true,
    exportarDatos: false,
    apiExterna: false,
  },
  pro: {
    usuarios: 25,
    tareas: 1000,
    historialDias: 730,
    alertasEmail: true,
    exportarDatos: true,
    apiExterna: false,
  },
  empresa: {
    usuarios: Infinity,
    tareas: Infinity,
    historialDias: Infinity,
    alertasEmail: true,
    exportarDatos: true,
    apiExterna: true,
  },
}

export const PRECIOS_MENSUALES: Record<Exclude<PlanCodigo, 'individual'>, number> = {
  basico: 9,
  pro: 29,
  empresa: 79,
}

export const PRECIOS_ANUALES: Record<Exclude<PlanCodigo, 'individual'>, number> = {
  basico: 90,
  pro: 290,
  empresa: 790,
}

export function getLimitesPlan(planCodigo: PlanCodigo): LimitePlan {
  return LIMITES_POR_PLAN[planCodigo] ?? LIMITES_POR_PLAN.individual
}

export async function verificarLimiteTareas(
  supabase: { from: (table: string) => unknown },
  organismoId: string,
  suscripcion: OrganismoSuscripcion | null
): Promise<{ permitido: boolean; motivo?: string }> {
  if (esOrganismoSegesa(organismoId)) return { permitido: true }

  const plan = suscripcion?.plan_codigo ?? 'individual'
  const limite = getLimitesPlan(plan as PlanCodigo).tareas

  if (limite === Infinity) return { permitido: true }

  const db = supabase as {
    from: (t: string) => {
      select: (c: string, o: object) => {
        eq: (c: string, v: unknown) => { neq: (c: string, v: unknown) => Promise<{ count: number | null }> }
      }
    }
  }

  const result = await db
    .from('tareas')
    .select('*', { count: 'exact', head: true })
    .eq('organismo_id', organismoId)
    .neq('estado', 'Cancelado')

  const count = result.count ?? 0

  if (count >= limite) {
    return {
      permitido: false,
      motivo: `El plan ${plan} admite máximo ${limite} tareas activas. Actualiza el plan para continuar.`,
    }
  }

  return { permitido: true }
}

export async function verificarLimiteUsuarios(
  supabase: { from: (table: string) => unknown },
  organismoId: string,
  suscripcion: OrganismoSuscripcion | null
): Promise<{ permitido: boolean; motivo?: string }> {
  if (esOrganismoSegesa(organismoId)) return { permitido: true }

  const plan = suscripcion?.plan_codigo ?? 'individual'
  const limite = getLimitesPlan(plan as PlanCodigo).usuarios

  if (limite === Infinity) return { permitido: true }

  const db = supabase as {
    from: (t: string) => {
      select: (c: string, o: object) => {
        eq: (c: string, v: unknown) => Promise<{ count: number | null }>
      }
    }
  }

  const result = await db
    .from('organismo_miembros')
    .select('*', { count: 'exact', head: true })
    .eq('organismo_id', organismoId)

  const count = result.count ?? 0

  if (count >= limite) {
    return {
      permitido: false,
      motivo: `El plan ${plan} admite máximo ${limite} usuarios. Actualiza el plan para invitar más miembros.`,
    }
  }

  return { permitido: true }
}
