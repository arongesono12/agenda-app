'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Bell,
  BarChart3,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  CreditCard,
  GanttChartSquare,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import UserAvatar from '@/components/ui/UserAvatar'
import OrganismoSelector from '@/components/OrganismoSelector'
import { useUserSession } from '@/components/UserSessionProvider'
import { ADMIN_ROLE_CODES, MANAGER_ROLE_CODES } from '@/lib/access-control'
import { SEGESA_ORGANISMO_ID } from '@/lib/types'

const SIDEBAR_COLLAPSED_KEY = 'agenda-sidebar-collapsed'

const navItems = [
  { href: '/', label: 'Agenda diaria', icon: CalendarDays, badge: null, group: 'work' },
  { href: '/mis-tareas', label: 'Mis tareas', icon: CheckSquare, badge: null, group: 'work' },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null, group: 'work' },
  { href: '/alertas', label: 'Alertas', icon: Bell, badge: 'alert', group: 'work' },
  { href: '/cronograma', label: 'Cronograma', icon: GanttChartSquare, badge: null, group: 'work' },
  { href: '/estadisticas', label: 'Estadisticas', icon: BarChart3, badge: null, group: 'work' },
  { href: '/responsable', label: 'Responsables', icon: User, badge: null, group: 'tools' },
  { href: '/historial', label: 'Historial', icon: History, badge: null, group: 'tools' },
  { href: '/catalogos', label: 'Catalogos', icon: Settings, badge: null, group: 'tools' },
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

function CollapsedNavTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.9rem)] top-1/2 z-[80] flex min-h-11 -translate-y-1/2 translate-x-0 items-center whitespace-nowrap rounded-[18px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-900 opacity-0 shadow-[0_20px_48px_rgba(15,23,42,0.18)] ring-1 ring-white/80 transition-all duration-200 ease-out group-hover:translate-x-1.5 group-hover:opacity-100 group-focus-visible:translate-x-1.5 group-focus-visible:opacity-100">
      <span className="absolute -left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 border-b border-l border-slate-200 bg-white" />
      <span className="relative leading-none">{label}</span>
    </span>
  )
}

function NavGroup({
  label,
  items,
  pathname,
  alertCount,
  collapsed,
  onNavigate,
  first = false,
}: {
  label: string
  items: typeof navItems
  pathname: string
  alertCount: number
  collapsed: boolean
  onNavigate?: () => void
  first?: boolean
}) {
  if (items.length === 0) return null

  return (
    <div>
      {!first && (
        collapsed ? (
          <div className="mx-2 mb-1 mt-2 border-t border-slate-100/80" />
        ) : (
          <p className="mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">
            {label}
          </p>
        )
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const showBadge = item.badge === 'alert' && alertCount > 0

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  'group relative flex items-center rounded-2xl border py-2.5 text-sm font-medium transition-all duration-150',
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  isActive
                    ? 'nav-active'
                    : 'border-transparent text-slate-600 hover:border-white/70 hover:bg-white/60 hover:text-slate-900'
                )}
              >
                <span
                  className={cn(
                    'relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150',
                    isActive
                      ? 'bg-slate-50 text-teal-700'
                      : 'text-slate-400 group-hover:text-slate-700'
                  )}
                >
                  <Icon size={16} />
                  {collapsed && showBadge && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-[0_0_0_2px_white]">
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </span>

                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {showBadge && (
                      <span className="inline-flex h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-[0_0_0_3px_rgba(239,68,68,0.15)]">
                        {alertCount > 99 ? '99+' : alertCount}
                      </span>
                    )}
                  </>
                )}
                {collapsed && <CollapsedNavTooltip label={item.label} />}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SidebarContent({
  pathname,
  onNavigate,
  onClose,
  showClose = false,
  collapsed = false,
  onToggleCollapsed,
}: {
  pathname: string
  onNavigate?: () => void
  onClose?: () => void
  showClose?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const { profile, capabilities, organismoActivo, rolEnOrganismo } = useUserSession()
  const [alertCount, setAlertCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => capabilities.navItems.includes(item.href)),
    [capabilities.navItems]
  )
  const workItems = useMemo(() => visibleNavItems.filter((i) => i.group === 'work'), [visibleNavItems])
  const toolItems = useMemo(() => visibleNavItems.filter((i) => i.group === 'tools'), [visibleNavItems])
  const isSegesaUser = profile?.email?.trim().toLowerCase().endsWith('@segesa.gq') ?? false
  const isSegesaOrganismo = organismoActivo?.id === SEGESA_ORGANISMO_ID
  const showOrganismoModule = !!organismoActivo && !isSegesaUser && !isSegesaOrganismo

  const userName = profile?.nombre_completo?.trim() || profile?.email?.split('@')[0] || 'Usuario'
  const userRole = profile?.tipo_usuario?.nombre?.trim() || 'Responsable'
  const avatarUrl = profile?.avatar_url ?? null

  useEffect(() => {
    let cancelled = false
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/alertas/unread', { cache: 'no-store' })
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { count: number }
          setAlertCount(data.count)
        }
      } catch {
        // fallo silencioso
      }
    }
    void fetchUnread()
    const interval = setInterval(() => void fetchUnread(), 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
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
    <div className={cn('surface-panel-strong flex h-full min-h-0 flex-col text-slate-900', collapsed ? 'overflow-visible p-2.5' : 'overflow-hidden p-4')}>

      {/* â”€â”€ Brand header â”€â”€ */}
      <div className={cn('rounded-[24px] border border-white/70 bg-white/70', collapsed ? 'px-2.5 py-3' : 'px-4 py-3.5')}>
        <div className="flex items-center gap-3">
          <BrandMark className={cn('flex-shrink-0', collapsed ? 'h-10 w-10' : 'h-11 w-11')} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-teal-700">
                Control ejecutivo
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-tight text-slate-900">Plan de Trabajo</p>
            </div>
          )}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {onToggleCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white/80 text-slate-400 transition-colors hover:border-slate-200 hover:text-slate-700"
                aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              >
                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}
            {showClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 bg-white/80 text-slate-400 transition-colors hover:text-slate-900"
                aria-label="Cerrar menu"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Organism selector â”€â”€ */}
      {showOrganismoModule && (
        <div className="mt-3">
          <OrganismoSelector collapsed={collapsed} />
        </div>
      )}

      {/* â”€â”€ Nav â”€â”€ */}
      <div className={cn('mt-4 min-h-0 flex-1 rounded-[24px] border border-white/70 bg-white/55', collapsed ? 'overflow-visible px-2 py-2.5' : 'overflow-hidden px-3 py-3')}>
        <div className={cn('h-full pr-1', collapsed ? 'overflow-visible' : 'sidebar-scroll')}>
          <NavGroup
            label="Trabajo"
            items={workItems}
            pathname={pathname}
            alertCount={alertCount}
            collapsed={collapsed}
            onNavigate={onNavigate}
            first
          />
          <NavGroup
            label="Herramientas"
            items={toolItems}
            pathname={pathname}
            alertCount={alertCount}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />

          {/* â”€â”€ Organismo â”€â”€ */}
          {showOrganismoModule && (
            <div>
              {collapsed ? (
                <div className="mx-2 mb-1 mt-2 border-t border-slate-100/80" />
              ) : (
                <p className="mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Organismo
                </p>
              )}
              <ul className="space-y-0.5">
                {rolEnOrganismo && MANAGER_ROLE_CODES.includes(rolEnOrganismo as (typeof MANAGER_ROLE_CODES)[number]) && (
                  <li>
                    <Link
                      href={`/organismos/${organismoActivo.slug}/miembros`}
                      onClick={onNavigate}
                      aria-label={collapsed ? 'Miembros' : undefined}
                      className={cn(
                        'group relative flex items-center rounded-2xl border py-2.5 text-sm font-medium transition-all duration-150',
                        collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                        pathname.startsWith(`/organismos/${organismoActivo.slug}/miembros`)
                          ? 'nav-active'
                          : 'border-transparent text-slate-600 hover:border-white/70 hover:bg-white/60 hover:text-slate-900'
                      )}
                    >
                      <span className={cn(
                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150',
                        pathname.startsWith(`/organismos/${organismoActivo.slug}/miembros`)
                          ? 'bg-slate-50 text-teal-700'
                          : 'text-slate-400 group-hover:text-slate-700'
                      )}>
                        <Users size={16} />
                      </span>
                      {!collapsed && <span className="min-w-0 flex-1 truncate">Miembros</span>}
                      {collapsed && <CollapsedNavTooltip label="Miembros" />}
                    </Link>
                  </li>
                )}
                {rolEnOrganismo && ADMIN_ROLE_CODES.includes(rolEnOrganismo as (typeof ADMIN_ROLE_CODES)[number]) && (
                  <>
                    <li>
                      <Link
                        href={`/organismos/${organismoActivo.slug}/facturacion`}
                        onClick={onNavigate}
                        aria-label={collapsed ? 'Facturacion' : undefined}
                        className={cn(
                          'group relative flex items-center rounded-2xl border py-2.5 text-sm font-medium transition-all duration-150',
                          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                          pathname.startsWith(`/organismos/${organismoActivo.slug}/facturacion`)
                            ? 'nav-active'
                            : 'border-transparent text-slate-600 hover:border-white/70 hover:bg-white/60 hover:text-slate-900'
                        )}
                      >
                        <span className={cn(
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150',
                          pathname.startsWith(`/organismos/${organismoActivo.slug}/facturacion`)
                            ? 'bg-slate-50 text-teal-700'
                            : 'text-slate-400 group-hover:text-slate-700'
                        )}>
                          <CreditCard size={16} />
                        </span>
                        {!collapsed && <span className="min-w-0 flex-1 truncate">FacturaciÃ³n</span>}
                        {collapsed && <CollapsedNavTooltip label="Facturación" />}
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`/organismos/${organismoActivo.slug}/ajustes`}
                        onClick={onNavigate}
                        aria-label={collapsed ? 'Ajustes org.' : undefined}
                        className={cn(
                          'group relative flex items-center rounded-2xl border py-2.5 text-sm font-medium transition-all duration-150',
                          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                          pathname.startsWith(`/organismos/${organismoActivo.slug}/ajustes`)
                            ? 'nav-active'
                            : 'border-transparent text-slate-600 hover:border-white/70 hover:bg-white/60 hover:text-slate-900'
                        )}
                      >
                        <span className={cn(
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150',
                          pathname.startsWith(`/organismos/${organismoActivo.slug}/ajustes`)
                            ? 'bg-slate-50 text-teal-700'
                            : 'text-slate-400 group-hover:text-slate-700'
                        )}>
                          <Settings size={16} />
                        </span>
                        {!collapsed && <span className="min-w-0 flex-1 truncate">Ajustes org.</span>}
                        {collapsed && <CollapsedNavTooltip label="Ajustes org." />}
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ User panel â”€â”€ */}
      <div ref={menuRef} className={cn('relative mt-4 rounded-[24px] border border-white/70 bg-white/70', collapsed ? 'p-2' : 'p-3')}>

        {/* User popup menu */}
        {menuOpen && (
          <div
            className={cn(
              'avatar-menu-popover absolute z-20 overflow-hidden rounded-[22px] border border-white/80 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]',
              collapsed ? 'bottom-0 left-[calc(100%+0.75rem)] w-64' : 'inset-x-3 bottom-[calc(100%+0.5rem)]'
            )}
          >
            <div className="avatar-menu-card rounded-[18px] border border-slate-100 bg-slate-50/80 px-4 py-3">
              <p className="avatar-menu-name truncate text-sm font-semibold text-slate-900">{userName}</p>
              <span className="avatar-menu-role mt-2 inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                {userRole}
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              <Link
                href="/perfil"
                onClick={() => { setMenuOpen(false); onNavigate?.() }}
                className="avatar-menu-item flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <CircleUserRound size={15} />
                Perfil
              </Link>
              <Link
                href="/configuracion"
                onClick={() => { setMenuOpen(false); onNavigate?.() }}
                className="avatar-menu-item flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Settings size={15} />
                Configuracion
              </Link>
              <div className="avatar-menu-separator mx-2 my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="avatar-menu-danger flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
              >
                <LogOut size={15} />
                {signingOut ? 'Cerrando sesion...' : 'Cerrar sesion'}
              </button>
            </div>
          </div>
        )}

        {/* User trigger button */}
        <button
          type="button"
          onClick={() => setMenuOpen((c) => !c)}
          title={collapsed ? userName : undefined}
          className={cn(
            'group flex w-full items-center rounded-[18px] text-left transition-colors hover:bg-white/60',
            collapsed ? 'justify-center p-1.5' : 'gap-3 p-2'
          )}
        >
          <div className="relative flex-shrink-0">
            <UserAvatar
              name={userName}
              avatarUrl={avatarUrl}
              size="md"
              className="h-11 w-11 rounded-full ring-0 transition-all duration-200 group-hover:ring-2 group-hover:ring-teal-200"
            />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                <p className="truncate text-[11px] text-slate-500">{userRole}</p>
              </div>
              {menuOpen
                ? <ChevronUp size={13} className="flex-shrink-0 text-slate-400" />
                : <ChevronDown size={13} className="flex-shrink-0 text-slate-400" />
              }
            </>
          )}
        </button>

        {/* Status + ThemeToggle */}
        <div className={cn('mt-2 flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-emerald-400" />
            {!collapsed && <span className="text-[11px] text-slate-500">Sistema activo</span>}
          </div>
          <ThemeToggle
            className={cn(
              'border-white/70 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900',
              collapsed ? 'h-9 w-full min-w-0 justify-center px-0 [&>span]:hidden' : 'h-8 px-2.5 text-[11px]'
            )}
          />
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const activeItem = useMemo(
    () => navItems.find((item) => pathname === item.href)?.label ?? 'Panel',
    [pathname]
  )

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    setCollapsed(saved === 'true')
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, `${next}`)
      return next
    })
  }

  return (
    <>
      {/* Mobile topbar */}
      <div className="mobile-topbar no-print fixed inset-x-0 top-0 z-40 lg:hidden">
        <div className="mobile-topbar-inner mx-auto flex w-full max-w-[1560px] items-center justify-between gap-2 px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.65rem)] sm:gap-3 sm:px-6 sm:pb-3 sm:pt-[calc(env(safe-area-inset-top)+0.8rem)]">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10 flex-shrink-0 sm:h-11 sm:w-11" />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-[0.22em]">
                Plan de Trabajo
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">{activeItem}</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <ThemeToggle className="mobile-topbar-btn h-10 w-10 rounded-xl p-0 sm:h-11 sm:w-auto sm:rounded-2xl sm:px-3" />
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mobile-topbar-btn flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'no-print hidden flex-shrink-0 p-4 transition-[width,padding] duration-300 lg:block',
          collapsed ? 'w-[7.5rem]' : 'w-[var(--sidebar-width)]'
        )}
      >
        <div className="sticky top-4 h-[calc(100vh-2rem)]">
          <SidebarContent
            pathname={pathname}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            aria-label="Cerrar menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-2 left-2 w-[min(92vw,22rem)] sm:inset-y-4 sm:left-4 sm:w-[min(88vw,22rem)]">
            <div className="h-full overflow-hidden">
              <SidebarContent
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                onClose={() => setOpen(false)}
                showClose
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

