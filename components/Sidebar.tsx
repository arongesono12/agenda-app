'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState, useEffect, useRef } from 'react'
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
  CircleUserRound,
  GanttChartSquare,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import UserAvatar from '@/components/ui/UserAvatar'
import { useUserSession } from '@/components/UserSessionProvider'

const navItems = [
  { href: '/', label: 'Agenda diaria', icon: CalendarDays, badge: null },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { href: '/alertas', label: 'Alertas', icon: Bell, badge: 'alert' },
  { href: '/cronograma', label: 'Cronograma', icon: GanttChartSquare, badge: null },
  { href: '/estadisticas', label: 'Estadisticas', icon: BarChart3, badge: null },
  { href: '/busqueda', label: 'Busqueda', icon: Search, badge: null },
  { href: '/responsable', label: 'Responsables', icon: User, badge: null },
  { href: '/historial', label: 'Historial', icon: History, badge: null },
  { href: '/catalogos', label: 'Catalogos', icon: Settings, badge: null, adminOnly: true },
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
        alt="Logo de Plan de Trabajo"
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
  const { profile, isAdmin } = useUserSession()
  const [alertCount, setAlertCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  )
  const userName = profile?.nombre_completo?.trim() || profile?.email?.split('@')[0] || 'Usuario'
  const userRole = profile?.tipo_usuario?.nombre?.trim() || 'Responsable'
  const avatarUrl = profile?.avatar_url ?? null

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('tareas')
        .select('fecha_fin')
        .not('estado', 'in', '("Completado","Cancelado")')

      if (data) {
        const normalized = normalizarTareas(data as Array<{ fecha_fin?: string }> | null)
        const count = normalized.filter(
          (t) =>
            t.semaforo === SEMAFORO_VENCIDA ||
            t.semaforo === SEMAFORO_URGENTE ||
            t.semaforo === SEMAFORO_PROXIMA
        ).length
        setAlertCount(count)
      }
    }

    void fetchAlerts()
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
    setSigningOut(false)
  }

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
              <p className="mt-1 text-lg font-semibold text-slate-900">Plan de Trabajo</p>
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
            {visibleNavItems.map((item) => {
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
                      className={cn(
                        'transition-all',
                        isActive ? 'translate-x-0 text-teal-100' : 'translate-x-1 text-slate-400 group-hover:text-slate-600'
                      )}
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div ref={menuRef} className="relative mt-5 rounded-[28px] border border-white/70 bg-gradient-to-br from-white/85 to-white/60 p-5">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="group block w-full rounded-[24px] text-left transition-transform duration-200 hover:-translate-y-0.5"
          title="Abrir menu de usuario"
        >
          <div className="flex flex-col items-center text-center">
            <UserAvatar
              name={userName}
              avatarUrl={avatarUrl}
              size="lg"
              className="h-20 w-20 rounded-full ring-0 transition-all duration-200 group-hover:ring-4 group-hover:ring-teal-100"
            />
            <div className="mt-3 min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">{userName}</p>
              <span className="mt-2 inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                {userRole}
              </span>
            </div>
          </div>
        </button>

        {menuOpen && (
          <div className="absolute inset-x-5 bottom-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-[24px] border border-white/80 bg-white/95 p-2 shadow-[0_22px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <Link
              href="/perfil"
              onClick={() => {
                setMenuOpen(false)
                onNavigate?.()
              }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <CircleUserRound size={16} />
              Perfil
            </Link>
            <Link
              href="/configuracion"
              onClick={() => {
                setMenuOpen(false)
                onNavigate?.()
              }}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <Settings size={16} />
              Configuracion
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
            >
              <LogOut size={16} />
              {signingOut ? 'Cerrando sesion...' : 'Cerrar sesion'}
            </button>
          </div>
        )}

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
  const activeItem = useMemo(
    () => navItems.find((item) => pathname === item.href)?.label ?? 'Panel',
    [pathname]
  )

  return (
    <>
      <div className="mobile-topbar no-print fixed inset-x-0 top-0 z-40 lg:hidden">
        <div className="mobile-topbar-inner mx-auto flex w-full max-w-[1560px] items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] sm:px-6">
          <div className="min-w-0 flex items-center gap-3">
            <BrandMark className="h-11 w-11 flex-shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Plan de Trabajo
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">{activeItem}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="mobile-topbar-btn h-11 w-11 rounded-2xl p-0 sm:w-auto sm:px-3" />
            <button
              onClick={() => setOpen(true)}
              className="mobile-topbar-btn flex h-11 w-11 items-center justify-center rounded-2xl"
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
