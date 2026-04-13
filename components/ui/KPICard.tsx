import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  color?: 'teal' | 'blue' | 'amber' | 'red' | 'slate' | 'purple'
  trend?: { value: string; up: boolean }
}

const colorMap = {
  teal: {
    border: 'border-teal-100/80',
    glow: 'from-teal-500/18 via-cyan-400/10 to-transparent',
    icon: 'kpi-icon-shell bg-teal-500/12 text-teal-700',
    value: 'text-teal-900',
  },
  blue: {
    border: 'border-sky-100/80',
    glow: 'from-sky-500/18 via-blue-400/10 to-transparent',
    icon: 'kpi-icon-shell bg-sky-500/12 text-sky-700',
    value: 'text-sky-900',
  },
  amber: {
    border: 'border-amber-100/80',
    glow: 'from-amber-500/18 via-orange-400/10 to-transparent',
    icon: 'kpi-icon-shell bg-amber-500/12 text-amber-700',
    value: 'text-amber-900',
  },
  red: {
    border: 'border-rose-100/80',
    glow: 'from-rose-500/18 via-red-400/10 to-transparent',
    icon: 'kpi-icon-shell bg-rose-500/12 text-rose-700',
    value: 'text-rose-900',
  },
  slate: {
    border: 'border-slate-200/80',
    glow: 'from-slate-400/14 via-slate-200/12 to-transparent',
    icon: 'kpi-icon-shell bg-slate-900/6 text-slate-700',
    value: 'text-slate-900',
  },
  purple: {
    border: 'border-fuchsia-100/80',
    glow: 'from-fuchsia-500/16 via-violet-400/10 to-transparent',
    icon: 'kpi-icon-shell bg-fuchsia-500/12 text-fuchsia-700',
    value: 'text-fuchsia-900',
  },
}

export default function KPICard({ label, value, sub, icon, color = 'slate', trend }: KPICardProps) {
  const c = colorMap[color]

  return (
    <div className={cn('surface-panel kpi-card kpi-shell relative overflow-hidden p-5', c.border)}>
      <div className={cn('kpi-glow pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br', c.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]', c.icon)}>
          {icon}
        </div>
        {trend && (
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', trend.up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
            {trend.up ? '\u2191' : '\u2193'} {trend.value}
          </span>
        )}
      </div>

      <div className="relative mt-5">
        <p className={cn('text-3xl font-semibold tracking-[-0.04em]', c.value)}>{value}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
        {sub && <p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p>}
      </div>
    </div>
  )
}
