'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  Bell,
  CalendarClock,
  CalendarRange,
  History,
  ListChecks,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import KPICard from '@/components/ui/KPICard'
import ProgressBar from '@/components/ui/ProgressBar'
import { PrioridadBadge, EstadoBadge } from '@/components/ui/Badge'
import { useUserSession } from '@/components/UserSessionProvider'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const PIE_COLORS = ['#0f766e', '#0284c7', '#f59e0b', '#ef4444']

type DashboardData = {
  kpis: {
    total: number
    completadas: number
    enProceso: number
    pendientes: number
    canceladas?: number
    activas?: number
    alta: number
    vencidas: number
    urgentes?: number
    proximas?: number
    sinResponsable?: number
    avance: number
  }
  deptData: Array<{ name: string; total: number; completadas: number; enProceso: number; pendientes: number }>
  respData: Array<[string, { total: number; completadas: number; enProceso: number; pendientes: number }]>
  pieData: Array<{ name: string; value: number }>
  priData: Array<{ name: 'Alta' | 'Media' | 'Baja'; value: number }>
  recientes: Array<{
    id: number
    tarea: string
    prioridad: 'Alta' | 'Media' | 'Baja'
    estado: 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado'
    updated_at?: string | null
    created_at?: string | null
  }>
  alertSummary: {
    total: number
    noLeidas: number
    recientes: Array<{
      id: number
      tarea_id?: number | null
      tipo_alerta?: string | null
      titulo: string | null
      mensaje: string | null
      modulo: string
      leida: boolean | null
      created_at: string | null
      asignado_a?: string | null
      asignado_a_email?: string | null
      asignado_por?: string | null
    }>
  }
  meetingSummary: {
    proximas: number
    programadas: number
    pendientesRespuesta: number
    recientes: Array<{ id: string; titulo: string; fecha_inicio: string; modalidad: string; estado: string }>
  }
  calendarSummary: {
    eventosMes: number
    festivosMes: number
    eventosHoy: number
    proximos: Array<{ id: string; titulo: string; fecha_inicio: string; fecha_fin: string | null; tipo_evento: string; es_festivo: boolean; color: string }>
  }
  historySummary: {
    totalReciente: number
    recientes: Array<{ id: number; fecha: string | null; usuario: string | null; tarea_id: number | null; tarea_nombre: string | null; tipo_cambio: string; observaciones: string | null }>
  }
}

const EMPTY_DASHBOARD: DashboardData = {
  kpis: {
    total: 0,
    completadas: 0,
    enProceso: 0,
    pendientes: 0,
    canceladas: 0,
    activas: 0,
    alta: 0,
    vencidas: 0,
    urgentes: 0,
    proximas: 0,
    sinResponsable: 0,
    avance: 0,
  },
  deptData: [],
  respData: [],
  pieData: [],
  priData: [],
  recientes: [],
  alertSummary: { total: 0, noLeidas: 0, recientes: [] },
  meetingSummary: { proximas: 0, programadas: 0, pendientesRespuesta: 0, recientes: [] },
  calendarSummary: { eventosMes: 0, festivosMes: 0, eventosHoy: 0, proximos: [] },
  historySummary: { totalReciente: 0, recientes: [] },
}

function formatShortDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DashboardPage() {
  const { capabilities } = useUserSession()
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const response = await window.fetch('/api/dashboard')
    const result = (await response.json()) as ({ ok?: boolean; error?: string } & Partial<DashboardData>)

    if (response.ok && result.ok) {
      setDashboard({
        kpis: result.kpis ?? EMPTY_DASHBOARD.kpis,
        deptData: result.deptData ?? [],
        respData: result.respData ?? [],
        pieData: result.pieData ?? [],
        priData: result.priData ?? [],
        recientes: result.recientes ?? [],
        alertSummary: result.alertSummary ?? EMPTY_DASHBOARD.alertSummary,
        meetingSummary: result.meetingSummary ?? EMPTY_DASHBOARD.meetingSummary,
        calendarSummary: result.calendarSummary ?? EMPTY_DASHBOARD.calendarSummary,
        historySummary: result.historySummary ?? EMPTY_DASHBOARD.historySummary,
      })
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-teal-600" />
      </div>
    )
  }

  const { kpis, deptData, respData, pieData, priData, recientes, alertSummary, meetingSummary, calendarSummary, historySummary } = dashboard

  return (
    <div className="page-stack">
      <PageHeader
        title={capabilities.dashboardTitle}
        subtitle={capabilities.dashboardSubtitle}
        icon={<LayoutDashboard size={22} />}
        actions={
          <button onClick={fetch} className="action-btn icon-action-btn h-12 w-12 rounded-2xl" aria-label="Actualizar dashboard">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <KPICard label="Total tareas" value={kpis.total} icon={<Target size={18} />} color="slate" />
        <KPICard label="Activas" value={kpis.activas ?? 0} icon={<ListChecks size={18} />} color="blue" />
        <KPICard label="Completadas" value={kpis.completadas} icon={<CheckCircle2 size={18} />} color="teal" />
        <KPICard label="En proceso" value={kpis.enProceso} icon={<Clock size={18} />} color="blue" />
        <KPICard label="Pendientes" value={kpis.pendientes} icon={<Clock size={18} />} color="slate" />
        <KPICard label="Vencidas" value={kpis.vencidas} icon={<AlertTriangle size={18} />} color="red" />
        <KPICard label="Avance" value={`${kpis.avance}%`} icon={<TrendingUp size={18} />} color="teal" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KPICard label="Alta prioridad" value={kpis.alta} icon={<AlertTriangle size={18} />} color="red" />
        <KPICard label="Urgentes" value={kpis.urgentes ?? 0} icon={<Clock size={18} />} color="amber" />
        <KPICard label="Próximas" value={kpis.proximas ?? 0} icon={<CalendarClock size={18} />} color="blue" />
        <KPICard label="Alertas sin leer" value={alertSummary.noLeidas} icon={<Bell size={18} />} color={alertSummary.noLeidas > 0 ? 'red' : 'slate'} />
        <KPICard label="Reuniones próximas" value={meetingSummary.proximas} icon={<CalendarClock size={18} />} color="purple" />
        <KPICard label="Eventos hoy" value={calendarSummary.eventosHoy} icon={<CalendarRange size={18} />} color="teal" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="surface-panel p-5">
          <p className="label-field">Alertas</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{alertSummary.noLeidas} sin leer</h3>
          <p className="mt-2 text-sm text-slate-500">{alertSummary.total} alertas recientes dentro del alcance.</p>
        </div>
        <div className="surface-panel p-5">
          <p className="label-field">Reuniones</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{meetingSummary.programadas} programadas</h3>
          <p className="mt-2 text-sm text-slate-500">{meetingSummary.pendientesRespuesta} invitaciones pendientes de respuesta.</p>
        </div>
        <div className="surface-panel p-5">
          <p className="label-field">Calendario</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{calendarSummary.eventosMes} eventos este mes</h3>
          <p className="mt-2 text-sm text-slate-500">{calendarSummary.festivosMes} festivos registrados en el mes.</p>
        </div>
        <div className="surface-panel p-5">
          <p className="label-field">Historial</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{historySummary.totalReciente} movimientos</h3>
          <p className="mt-2 text-sm text-slate-500">Entradas recientes sobre tareas visibles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="surface-panel p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="label-field">Distribucion</p>
              <h3 className="text-lg font-semibold text-slate-900">Tareas por departamento</h3>
            </div>
            <span className="section-label">Top 8</span>
          </div>
          {deptData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe6f1" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 18px 40px rgba(15,23,42,0.1)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.6)' }}
                />
                <Bar dataKey="completadas" name="Completadas" fill="#0f766e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="enProceso" name="En proceso" fill="#0284c7" radius={[8, 8, 0, 0]} />
                <Bar dataKey="pendientes" name="Pendientes" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="surface-panel sidebar-style-card p-5">
          <div className="mb-4">
            <p className="label-field">Estado global</p>
            <h3 className="text-lg font-semibold text-slate-900">Distribucion por estado</h3>
          </div>
          {pieData.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={62} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.7)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="surface-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-teal-600" />
            <h3 className="text-lg font-semibold text-slate-900">Carga por responsable</h3>
          </div>
          <div className="space-y-4">
            {respData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Sin datos</p>
            ) : (
              respData.map(([name, value]) => (
                <div key={name} className="rounded-[22px] border border-white/70 bg-white/55 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
                    <span className="text-xs font-semibold text-slate-500">
                      {value.completadas}/{value.total} completadas
                    </span>
                  </div>
                  <ProgressBar value={value.total > 0 ? (value.completadas / value.total) * 100 : 0} size="md" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-panel p-5">
            <div className="mb-4">
              <p className="label-field">Prioridades</p>
              <h3 className="text-lg font-semibold text-slate-900">Distribucion por prioridad</h3>
            </div>
            {priData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Sin datos</p>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={priData} cx="50%" cy="50%" innerRadius={34} outerRadius={58} dataKey="value" paddingAngle={4}>
                      {priData.map((_, i) => (
                        <Cell key={i} fill={['#ef4444', '#f59e0b', '#0f766e'][i]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {priData.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/60 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ['#ef4444', '#f59e0b', '#0f766e'][i] }} />
                        <span className="text-sm text-slate-700">{p.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="surface-panel p-5">
            <div className="mb-4">
              <p className="label-field">Actividad</p>
              <h3 className="text-lg font-semibold text-slate-900">Tareas recientes</h3>
            </div>
            <div className="space-y-3">
              {recientes.map((t) => (
                <div key={t.id} className="rounded-[22px] border border-white/70 bg-white/60 p-4">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-800">{t.tarea}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EstadoBadge value={t.estado} />
                    <PrioridadBadge value={t.prioridad} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="surface-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-rose-600" />
            <h3 className="text-lg font-semibold text-slate-900">Alertas recientes</h3>
          </div>
          <div className="space-y-3">
            {alertSummary.recientes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Sin alertas recientes</p>
            ) : (
              alertSummary.recientes.slice(0, 5).map((alerta) => (
                <div key={alerta.id} className="rounded-[20px] border border-white/70 bg-white/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">{alerta.titulo ?? 'Alerta'}</p>
                    {!alerta.leida && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-rose-500" />}
                  </div>
                  {alerta.tipo_alerta === 'Asignada' && (
                    <div className="mt-2 space-y-1 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <p className="text-xs font-semibold text-slate-700">
                        Asignada a: {alerta.asignado_a ?? alerta.asignado_a_email ?? 'Responsable no identificado'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Asigno: {alerta.asignado_por ?? 'Sin dato de asignador'}
                      </p>
                    </div>
                  )}
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                    {alerta.tipo_alerta === 'Asignada'
                      ? (alerta.mensaje ?? '').replace(/^Se te asigno/i, 'Se asigno')
                      : alerta.mensaje ?? alerta.modulo}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock size={16} className="text-fuchsia-600" />
            <h3 className="text-lg font-semibold text-slate-900">Próximas reuniones</h3>
          </div>
          <div className="space-y-3">
            {meetingSummary.recientes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Sin reuniones próximas</p>
            ) : (
              meetingSummary.recientes.map((reunion) => (
                <div key={reunion.id} className="rounded-[20px] border border-white/70 bg-white/60 p-3">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-800">{reunion.titulo}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="badge border-slate-200 bg-slate-100 text-slate-600">{reunion.modalidad}</span>
                    <span>{formatDateTime(reunion.fecha_inicio)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarRange size={16} className="text-teal-600" />
            <h3 className="text-lg font-semibold text-slate-900">Calendario</h3>
          </div>
          <div className="space-y-3">
            {calendarSummary.proximos.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Sin eventos próximos</p>
            ) : (
              calendarSummary.proximos.map((evento) => (
                <div key={evento.id} className="rounded-[20px] border border-white/70 bg-white/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">{evento.titulo}</p>
                    {evento.es_festivo && <span className="badge border-rose-200 bg-rose-50 text-rose-700">Festivo</span>}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatShortDate(evento.fecha_inicio)}
                    {evento.fecha_fin && evento.fecha_fin !== evento.fecha_inicio ? ` - ${formatShortDate(evento.fecha_fin)}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="surface-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <History size={16} className="text-sky-600" />
            <h3 className="text-lg font-semibold text-slate-900">Historial reciente</h3>
          </div>
          <div className="space-y-3">
            {historySummary.recientes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Sin movimientos recientes</p>
            ) : (
              historySummary.recientes.slice(0, 5).map((row) => (
                <div key={row.id} className="rounded-[20px] border border-white/70 bg-white/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{row.tipo_cambio}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{row.tarea_nombre ?? `Tarea #${row.tarea_id ?? '-'}`}</p>
                  <p className="mt-2 text-xs text-slate-500">{row.usuario ?? 'Sistema'} · {formatDateTime(row.fecha)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="surface-panel-dark p-6 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/80">
              Resumen ejecutivo
            </span>
            <h3 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">Avance global del proyecto</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              {kpis.completadas} de {kpis.total} tareas completadas. Usa esta lectura para priorizar frentes atrasados y carga del equipo.
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-semibold tracking-[-0.05em] text-teal-200">{kpis.avance}%</p>
            <p className="mt-1 text-sm text-slate-300">avance promedio</p>
          </div>
        </div>
        <div className="mt-5 h-3 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-300 transition-all duration-1000"
            style={{ width: `${kpis.avance}%` }}
          />
        </div>
      </div>
    </div>
  )
}
