import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('surface-panel-strong overflow-hidden p-5 sm:p-6', className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="relative mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-[0_20px_40px_rgba(20,184,166,0.26)] sm:h-14 sm:w-14 sm:rounded-[22px]">
              <div className="absolute inset-0 rounded-[20px] bg-white/10 sm:rounded-[22px]" />
              <span className="relative">{icon}</span>
            </div>
          )}

          <div className="min-w-0">
            <span className="section-label">Vista operativa</span>
            <h1 className="section-title mt-3">{title}</h1>
            {subtitle && <p className="section-copy mt-3 max-w-2xl">{subtitle}</p>}
          </div>
        </div>

        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
