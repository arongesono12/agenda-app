import { cn } from '@/lib/utils'
import type { PlanCodigo, EstadoSuscripcion } from '@/lib/types'

const PLAN_STYLES: Record<PlanCodigo, string> = {
  individual: 'bg-slate-100 text-slate-600 border-slate-200',
  basico: 'bg-sky-50 text-sky-700 border-sky-200',
  pro: 'bg-teal-50 text-teal-700 border-teal-200',
  empresa: 'bg-purple-50 text-purple-700 border-purple-200',
}

const PLAN_NAMES: Record<PlanCodigo, string> = {
  individual: 'Individual',
  basico: 'Básico',
  pro: 'Pro',
  empresa: 'Empresa',
}

const ESTADO_DOTS: Record<EstadoSuscripcion, string> = {
  activa: 'bg-emerald-400',
  prueba: 'bg-amber-400',
  pausada: 'bg-slate-400',
  cancelada: 'bg-rose-400',
}

interface PlanBadgeProps {
  planCodigo?: PlanCodigo | null
  estado?: EstadoSuscripcion | null
  className?: string
  showEstado?: boolean
}

export default function PlanBadge({ planCodigo, estado, className, showEstado = false }: PlanBadgeProps) {
  if (!planCodigo) return null

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', PLAN_STYLES[planCodigo], className)}>
      {showEstado && estado && (
        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', ESTADO_DOTS[estado])} />
      )}
      {PLAN_NAMES[planCodigo]}
      {showEstado && estado === 'prueba' && <span className="opacity-70">(prueba)</span>}
    </span>
  )
}
