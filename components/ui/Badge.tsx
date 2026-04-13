import { cn } from '@/lib/utils'
import { PRIORIDAD_COLORS, ESTADO_COLORS, TIPO_COLORS } from '@/lib/types'
import type { Prioridad, Estado, TipoTarea } from '@/lib/types'

export function PrioridadBadge({ value }: { value?: Prioridad | string | null }) {
  if (!value) return <span className="text-slate-400 text-xs">-</span>
  const color = PRIORIDAD_COLORS[value as Prioridad] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={cn('badge', color)}>{value}</span>
}

export function EstadoBadge({ value }: { value?: Estado | string | null }) {
  if (!value) return <span className="text-slate-400 text-xs">-</span>
  const color = ESTADO_COLORS[value as Estado] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={cn('badge', color)}>{value}</span>
}

export function TipoBadge({ value }: { value?: TipoTarea | string | null }) {
  if (!value) return <span className="text-slate-400 text-xs">-</span>
  const color = TIPO_COLORS[value as TipoTarea] || 'bg-slate-100 text-slate-600 border-slate-200'
  return <span className={cn('badge', color)}>{value}</span>
}

export function SemaforoBadge({ value }: { value?: string | null }) {
  if (!value || value === '\u26AA Sin fecha') return <span className="text-slate-400 text-xs">-</span>

  const colorMap: Record<string, string> = {
    '\u{1F534} Vencida': 'text-red-600',
    '\u{1F7E0} Urgente': 'text-orange-500',
    '\u{1F7E1} Pr\u00F3xima': 'text-amber-500',
    '\u{1F7E2} A tiempo': 'text-teal-600',
  }

  return <span className={cn('text-xs font-medium', colorMap[value] || 'text-slate-500')}>{value}</span>
}
