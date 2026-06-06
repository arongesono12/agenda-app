import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  color?: 'teal' | 'blue' | 'amber' | 'red' | 'slate' | 'purple'
  trend?: { value: string; up: boolean }
  layout?: 'default' | 'compact'
}

const colorMap = {
  teal: {
    glow: 'from-slate-200/24 via-slate-100/14 to-transparent',
    icon: 'kpi-icon-shell bg-teal-500/12 text-teal-700',
    value: 'text-teal-900',
  },
  blue: {
    glow: 'from-slate-200/24 via-slate-100/14 to-transparent',
    icon: 'kpi-icon-shell bg-sky-500/12 text-sky-700',
    value: 'text-sky-900',
  },
  amber: {
    glow: 'from-slate-200/24 via-slate-100/14 to-transparent',
    icon: 'kpi-icon-shell bg-amber-500/12 text-amber-700',
    value: 'text-amber-900',
  },
  red: {
    glow: 'from-slate-200/24 via-slate-100/14 to-transparent',
    icon: 'kpi-icon-shell bg-rose-500/12 text-rose-700',
    value: 'text-rose-900',
  },
  slate: {
    glow: 'from-slate-400/14 via-slate-200/12 to-transparent',
    icon: 'kpi-icon-shell bg-slate-900/6 text-slate-700',
    value: 'text-slate-900',
  },
  purple: {
    glow: 'from-slate-200/24 via-slate-100/14 to-transparent',
    icon: 'kpi-icon-shell bg-fuchsia-500/12 text-fuchsia-700',
    value: 'text-fuchsia-900',
  },
}

export default function KPICard({
  label,
  value,
  sub,
  icon,
  color = 'slate',
  trend,
}: KPICardProps) {
  const c = colorMap[color]

  return (
    <div className="surface-panel kpi-card kpi-shell relative overflow-hidden px-4 py-3">
      <div className={cn('kpi-glow pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-br', c.glow)} />
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
            c.icon
          )}
        >
          {icon}
        </div>

        <p className={cn('flex-shrink-0 text-xl font-semibold tracking-[-0.04em]', c.value)}>
          {value}
        </p>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{label}</p>
          {sub && <p className="truncate text-[11px] leading-4 text-slate-500">{sub}</p>}
        </div>

        {trend && (
          <span
            className={cn(
              'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            )}
          >
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}
