'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import {
  supabase,
  normalizarTareas,
  SEMAFORO_VENCIDA,
  SEMAFORO_URGENTE,
  SEMAFORO_PROXIMA,
} from '@/lib/supabase'
import {
  Bell,
  BarChart3,
  CalendarDays,
  ChevronRight,
  GanttChartSquare,
  History,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'

const navItems = [
  { href: '/', label: 'Agenda diaria', icon: CalendarDays, badge: null },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { href: '/alertas', label: 'Alertas', icon: Bell, badge: 'alert' },
  { href: '/cronograma', label: 'Cronograma', icon: GanttChartSquare, badge: null },
  { href: '/estadisticas', label: 'Estadisticas', icon: BarChart3, badge: null },
  { href: '/busqueda', label: 'Busqueda', icon: Search, badge: null },
  { href: '/responsable', label: 'Responsables', icon: User, badge: null },
  { href: '/historial', label: 'Historial', icon: History, badge: null },
  { href: '/catalogos', label: 'Catalogos', icon: Settings, badge: null },
]

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'logo-panel relative aspect-square overflow-hidden rounded-2xl border shadow-[0_14px_34px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      <Image
        src="/logo/Icon-S.png"
        alt="Logo de Agenda empresarial"
        fill
        sizes="(max-width: 640px) 40px, (max-width: 1024px) 44px, 52px"
        className="object-contain p-1.5 sm:p-2"
        priority
      />
    </div>
  )
}

function SidebarContent({
  pathname,
  onNavigate,
  onClose,
  showClose = false,
}: {
  pathname: string
  onNavigate?: () => void
  onClose?: () => void
  showClose?: boolean
}) {
  const activeItem = useMemo(
    () => navItems.find((item) => pathname === item.href)?.label ?? 'Panel',
    [pathname]
  )

  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('tareas')
        .select('fecha_fin')
        .not('estado', 'in', '("Completado","Cancelado")')
      
      if (data) {
        const normalized = normalizarTareas(data as any[])
        const count = normalized.filter(
          (t) =>
            t.semaforo === SEMAFORO_VENCIDA ||
            t.semaforo === SEMAFORO_URGENTE ||
            t.semaforo === SEMAFORO_PROXIMA
        ).length
        setAlertCount(count)
      }
    }
    fetchAlerts()
  }, [])

  return (
    <div className="surface-panel-strong flex h-full min-h-0 flex-col overflow-hidden p-4 text-slate-900">
      <div className="rounded-[24px] border border-white/70 bg-white/70 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <BrandMark className="h-12 w-12 sm:h-14 sm:w-14 lg:h-12 lg:w-12" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
                Control ejecutivo
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">Agenda empresarial</p>
            </div>
          </div>
          {showClose && onClose && (
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-slate-500 transition-colors hover:text-slate-900"
              aria-label="Cerrar menu"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <p className="mt-1 text-sm text-slate-600">
              Supervisa tareas, alertas y avance operativo desde un solo lugar.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/70 bg-white/55 p-3">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Modulos
        </p>
        <div className="mt-3 h-full overflow-y-auto pr-1">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'nav-item group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium',
                      isActive
                        ? 'nav-active border-teal-300/10 shadow-[0_14px_36px_rgba(20,184,166,0.16)]'
                        : 'border-transparent text-slate-700 hover:border-white/70 hover:bg-white/60 hover:text-slate-900'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
                        isActive ? 'bg-white/70 text-teal-700' : 'bg-white/60 text-slate-500 group-hover:text-slate-900'
                      )}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge === 'alert' && alertCount > 0 && (
                      <span className="inline-flex h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-[0_0_0_4px_rgba(239,68,68,0.18)]">
                        {alertCount > 99 ? '99+' : alertCount}
                      </span>
                    )}
                    <ChevronRight
                      size={15}
                      className={cn('transition-all', isActive ? 'translate-x-0 text-teal-100' : 'translate-x-1 text-slate-400 group-hover:text-slate-600')}
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/70 bg-gradient-to-br from-white/80 to-white/55 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Vista actual
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{activeItem}</p>
          </div>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70">
            <User size={16} className="text-slate-700" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Sistema activo y sincronizado
        </div>
        <ThemeToggle className="mt-4 w-full justify-center border-white/70 bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900" />
      </div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="no-print fixed left-4 right-4 top-4 z-40 lg:hidden">
        <div className="surface-panel flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-11 w-11 sm:h-12 sm:w-12" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Agenda empresarial
              </p>
              <p className="text-sm font-semibold text-slate-900">Control operativo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-11 w-11 rounded-2xl p-0 sm:w-auto sm:px-3" />
            <button
              onClick={() => setOpen(true)}
              className="action-btn h-11 w-11 rounded-2xl p-0"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>

      <aside className="no-print hidden w-[var(--sidebar-width)] flex-shrink-0 p-4 lg:block">
        <div className="sticky top-4 h-[calc(100vh-2rem)] overflow-hidden">
          <SidebarContent pathname={pathname} />
        </div>
      </aside>

      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            aria-label="Cerrar menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-4 left-4 w-[min(88vw,22rem)]">
            <div className="h-full overflow-hidden">
              <SidebarContent pathname={pathname} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} showClose />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
