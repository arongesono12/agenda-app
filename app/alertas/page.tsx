'use client'
import { useState, useEffect, useCallback } from 'react'
import { Bell, RefreshCw, AlertTriangle, Clock, Calendar, CheckCircle, Check } from 'lucide-react'
import { useToast } from '@/components/ToastProvider'
import {
  normalizarTareas,
  SEMAFORO_PROXIMA,
  SEMAFORO_URGENTE,
  SEMAFORO_VENCIDA,
  supabase,
} from '@/lib/supabase'
import type { Tarea } from '@/lib/types'
import { formatDateShort } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import { PrioridadBadge, EstadoBadge } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import KPICard from '@/components/ui/KPICard'
import { useUserSession } from '@/components/UserSessionProvider'

type AlertaInterna = {
  id: number
  tipo_alerta: string
  titulo?: string | null
  mensaje?: string | null
  leida: boolean
  created_at?: string | null
}

export default function AlertasPage() {
  const { user } = useUserSession()
  const toast = useToast()
  const [tasks, setTasks] = useState<Tarea[]>([])
  const [personalAlerts, setPersonalAlerts] = useState<AlertaInterna[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    await window.fetch('/api/alertas/vencimientos', { method: 'POST' }).catch(() => null)

    const params = new URLSearchParams({
      page: '0',
      pageSize: '100',
      orderBy: 'fecha_fin',
      ascending: 'true',
      summary: 'false',
      alertas: 'true',
    })
    const response = await window.fetch(`/api/tareas?${params.toString()}`)
    const result = (await response.json()) as { ok?: boolean; tasks?: Tarea[] }
    setTasks(response.ok && result.ok ? normalizarTareas(result.tasks ?? []) : [])

    if (user?.id) {
      const { data: alerts } = await supabase
        .from('alertas')
        .select('id, tipo_alerta, titulo, mensaje, leida, created_at')
        .eq('destinatario_usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)

      setPersonalAlerts((alerts ?? []) as AlertaInterna[])
    } else {
      setPersonalAlerts([])
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const marcarComoLeida = async (id: number) => {
    try {
      const res = await fetch('/api/alertas/marcar-leida', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (res.ok) {
        setPersonalAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, leida: true } : a)))
      }
    } catch {
      toast.error('No se pudo marcar como leída.')
    }
  }

  const marcarTodasComoLeidas = async () => {
    if (personalAlerts.every((a) => a.leida)) return
    setMarkingAll(true)
    try {
      const res = await fetch('/api/alertas/marcar-leida', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })

      if (res.ok) {
        setPersonalAlerts((prev) => prev.map((a) => ({ ...a, leida: true })))
        toast.success('Todas las alertas marcadas como leídas.')
      }
    } catch {
      toast.error('Error al procesar.')
    } finally {
      setMarkingAll(false)
    }
  }

  const vencidas = tasks.filter((t) => t.semaforo === SEMAFORO_VENCIDA)
  const urgentes = tasks.filter((t) => t.semaforo === SEMAFORO_URGENTE)
  const proximas = tasks.filter((t) => t.semaforo === SEMAFORO_PROXIMA)

  const AlertCard = ({ task, accent }: { task: Tarea; accent: string }) => (
    <div className="surface-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${accent}`} />
            <PrioridadBadge value={task.prioridad} />
            <EstadoBadge value={task.estado} />
          </div>
          <p className="line-clamp-2 text-sm font-semibold text-slate-900">{task.tarea}</p>
          {(task.departamento || task.responsable) && (
            <p className="mt-2 text-xs text-slate-500">
              {[task.departamento, task.responsable].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="rounded-[20px] border border-white/70 bg-white/70 px-3 py-2 text-right">
          <p className="text-xs font-semibold text-slate-500">{formatDateShort(task.fecha_fin)}</p>
          {task.dias_restantes !== null && task.dias_restantes !== undefined && (
            <p className={task.dias_restantes < 0 ? 'mt-1 text-xs font-semibold text-rose-500' : task.dias_restantes <= 2 ? 'mt-1 text-xs font-semibold text-amber-500' : 'mt-1 text-xs font-semibold text-sky-600'}>
              {task.dias_restantes < 0 ? `${Math.abs(task.dias_restantes)}d vencida` : `${task.dias_restantes}d restantes`}
            </p>
          )}
        </div>
      </div>
      <ProgressBar value={task.porcentaje_avance} showLabel className="mt-4" size="md" />
    </div>
  )

  const Section = ({
    title,
    subtitle,
    items,
    accent,
    icon,
  }: {
    title: string
    subtitle: string
    items: Tarea[]
    accent: string
    icon: React.ReactNode
  }) => (
    <div className="space-y-3">
      <div className="surface-panel p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-[20px] ${accent}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="ml-auto rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{items.length}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="surface-panel p-8 text-center text-sm text-slate-500">Sin tareas en esta categoria.</div>
      ) : (
        <div className="space-y-3">
          {items.map((task) => (
            <AlertCard
              key={task.id}
              task={task}
              accent={title === 'Vencidas' ? 'bg-rose-500' : title === 'Urgentes' ? 'bg-amber-500' : 'bg-sky-500'}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="page-stack">
      <PageHeader
        title="Centro de alertas"
        subtitle="Prioriza tareas con mayor riesgo operativo y detecta vencimientos antes de que afecten la ejecucion."
        icon={<Bell size={22} />}
        actions={
          <button onClick={() => void fetchData()} className="action-btn h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPICard label="Vencidas" value={vencidas.length} icon={<AlertTriangle size={18} />} color="red" />
        <KPICard label="Urgentes (<= 2 dias)" value={urgentes.length} icon={<Clock size={18} />} color="amber" />
        <KPICard label="Proximas (<= 5 dias)" value={proximas.length} icon={<Calendar size={18} />} color="blue" />
      </div>

      {personalAlerts.length > 0 && (
        <div className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/70 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Alertas para ti</p>
              <p className="text-xs text-slate-500">Asignaciones y vencimientos enviados dentro de la aplicacion.</p>
            </div>
            <button
              onClick={() => void marcarTodasComoLeidas()}
              disabled={markingAll || personalAlerts.every((a) => a.leida)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            >
              <CheckCircle size={14} />
              Marcar todas como leídas
            </button>
          </div>
          <div className="divide-y divide-slate-100/80">
            {personalAlerts.map((alert) => (
              <div key={alert.id} className="group relative px-5 py-4 transition-colors hover:bg-slate-50/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={alert.leida ? 'h-2.5 w-2.5 rounded-full bg-slate-200' : 'h-2.5 w-2.5 rounded-full bg-teal-500'} />
                      <span className="badge border-teal-200 bg-teal-50 text-teal-700">{alert.tipo_alerta}</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{alert.titulo ?? 'Alerta de agenda'}</p>
                    {alert.mensaje && <p className="mt-1 text-xs text-slate-500">{alert.mensaje}</p>}
                  </div>

                  {!alert.leida && (
                    <button
                      onClick={() => void marcarComoLeida(alert.id)}
                      className="mt-1 rounded-lg border border-transparent p-1.5 text-slate-400 opacity-0 transition-all hover:border-slate-200 hover:bg-white hover:text-teal-600 group-hover:opacity-100"
                      title="Marcar como leída"
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="surface-panel py-24 text-center">
          <RefreshCw size={24} className="mx-auto animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Section
            title="Vencidas"
            subtitle="Atencion inmediata requerida"
            items={vencidas}
            accent="bg-rose-500/12 text-rose-600"
            icon={<AlertTriangle size={18} />}
          />
          <Section
            title="Urgentes"
            subtitle="Vencen muy pronto"
            items={urgentes}
            accent="bg-amber-500/12 text-amber-600"
            icon={<Clock size={18} />}
          />
          <Section
            title="Proximas"
            subtitle="Seguimiento preventivo"
            items={proximas}
            accent="bg-sky-500/12 text-sky-600"
            icon={<Calendar size={18} />}
          />
        </div>
      )}
    </div>
  )
}
