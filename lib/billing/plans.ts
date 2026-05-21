import type { PlanCodigo } from '@/lib/types'
import { LIMITES_POR_PLAN, PRECIOS_MENSUALES, PRECIOS_ANUALES } from '@/lib/plan-limits'

export interface PlanDefinicion {
  codigo: PlanCodigo
  nombre: string
  descripcion: string
  precioMensual: number
  precioAnual: number
  stripePriceIdMensual?: string
  stripePriceIdAnual?: string
  destacado?: boolean
  limites: typeof LIMITES_POR_PLAN[PlanCodigo]
  caracteristicas: string[]
}

export const PLANES: PlanDefinicion[] = [
  {
    codigo: 'individual',
    nombre: 'Individual',
    descripcion: 'Para uso personal, sin costes.',
    precioMensual: 0,
    precioAnual: 0,
    limites: LIMITES_POR_PLAN.individual,
    caracteristicas: [
      '1 usuario',
      'Hasta 50 tareas activas',
      'Historial 90 días',
      'Sin alertas por correo',
    ],
  },
  {
    codigo: 'basico',
    nombre: 'Básico',
    descripcion: 'Equipos pequeños que necesitan organización.',
    precioMensual: PRECIOS_MENSUALES.basico,
    precioAnual: PRECIOS_ANUALES.basico,
    stripePriceIdMensual: process.env.STRIPE_PRICE_BASICO_MENSUAL,
    stripePriceIdAnual: process.env.STRIPE_PRICE_BASICO_ANUAL,
    limites: LIMITES_POR_PLAN.basico,
    caracteristicas: [
      'Hasta 5 usuarios',
      '200 tareas activas',
      'Historial 1 año',
      'Alertas por correo',
      'Soporte por email',
    ],
  },
  {
    codigo: 'pro',
    nombre: 'Pro',
    descripcion: 'Organizaciones medianas con mayor volumen.',
    precioMensual: PRECIOS_MENSUALES.pro,
    precioAnual: PRECIOS_ANUALES.pro,
    stripePriceIdMensual: process.env.STRIPE_PRICE_PRO_MENSUAL,
    stripePriceIdAnual: process.env.STRIPE_PRICE_PRO_ANUAL,
    destacado: true,
    limites: LIMITES_POR_PLAN.pro,
    caracteristicas: [
      'Hasta 25 usuarios',
      '1.000 tareas activas',
      'Historial 2 años',
      'Alertas por correo',
      'Exportar datos',
      'Soporte prioritario',
    ],
  },
  {
    codigo: 'empresa',
    nombre: 'Empresa',
    descripcion: 'Sin límites para grandes organizaciones.',
    precioMensual: PRECIOS_MENSUALES.empresa,
    precioAnual: PRECIOS_ANUALES.empresa,
    stripePriceIdMensual: process.env.STRIPE_PRICE_EMPRESA_MENSUAL,
    stripePriceIdAnual: process.env.STRIPE_PRICE_EMPRESA_ANUAL,
    limites: LIMITES_POR_PLAN.empresa,
    caracteristicas: [
      'Usuarios ilimitados',
      'Tareas ilimitadas',
      'Historial ilimitado',
      'Alertas por correo',
      'Exportar datos',
      'API externa',
      'Soporte dedicado',
    ],
  },
]

export function getPlan(codigo: PlanCodigo): PlanDefinicion {
  return PLANES.find((p) => p.codigo === codigo) ?? PLANES[0]
}
