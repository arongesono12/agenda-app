import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function ProgressBar({ value, className, showLabel = false, size = 'sm' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const color =
    clamped >= 100
      ? 'linear-gradient(90deg, #0f766e, #14b8a6)'
      : clamped >= 60
        ? 'linear-gradient(90deg, #0284c7, #38bdf8)'
        : clamped >= 30
          ? 'linear-gradient(90deg, #f59e0b, #fb923c)'
          : 'linear-gradient(90deg, #f97316, #ef4444)'

  const height = size === 'md' ? 'h-2.5' : 'h-2'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('progress-bar flex-1', height)}>
        <div className="progress-fill" style={{ width: `${clamped}%`, background: color }} />
      </div>
      {showLabel && (
        <span className="w-10 text-right text-xs font-semibold text-slate-500">{clamped}%</span>
      )}
    </div>
  )
}
