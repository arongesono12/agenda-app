'use client'

import type { ReactNode } from 'react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  FileText,
  FolderKanban,
  Hash,
  History,
  Pencil,
  ScrollText,
  Siren,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { Tarea } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'
import { EstadoBadge, PrioridadBadge, SemaforoBadge, TipoBadge } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'

interface TaskDetailPanelProps {
  task: Tarea | null
  canEditAgenda: boolean
  onEdit: (task: Tarea) => void
  onDelete: (task: Tarea) => void
  onOpenHistory: (task: Tarea) => void
  className?: string
}

interface DetailItemProps {
  icon: ReactNode
  label: string
  value: string
}

function DetailItem({ icon, label, value }: DetailItemProps) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/75 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">{value}</p>
    </div>
  )
}

function InfoBlock({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[26px] border border-white/80 bg-white/72 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatusCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone: 'red' | 'amber' | 'teal' | 'slate'
}) {
  const tones = {
    red: 'border-red-200 bg-red-50/90 text-red-700',
    amber: 'border-amber-200 bg-amber-50/90 text-amber-700',
    teal: 'border-teal-200 bg-teal-50/90 text-teal-700',
    slate: 'border-slate-200 bg-slate-50/90 text-slate-700',
  }

  return (
    <div className={cn('rounded-[22px] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]', tones[tone])}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-sm font-semibold leading-6">{value}</div>
    </div>
  )
}

export default function TaskDetailPanel({
  task,
  canEditAgenda,
  onEdit,
  onDelete,
  onOpenHistory,
  className,
}: TaskDetailPanelProps) {
  if (!task) {
    return (
      <aside className={cn('flex h-full items-center justify-center p-6', className)}>
        <div className="max-w-sm text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Detalle de tarea
          </p>
          <h3 className="mt-3 text-xl font-semibold text-slate-900">Selecciona una tarea de la lista</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Aqui veras la descripcion completa, notas, fechas y datos de seguimiento de la tarea activa.
          </p>
        </div>
      </aside>
    )
  }

  const ultimaActividad = task.ultima_actualizacion ?? task.updated_at ?? task.created_at
  const tiempoRestante =
    task.dias_restantes === null || task.dias_restantes === undefined
      ? 'Sin fecha limite'
      : task.dias_restantes < 0
        ? `${Math.abs(task.dias_restantes)} dia(s) vencida`
        : `${task.dias_restantes} dia(s) restantes`

  const vencimientoTone =
    task.dias_restantes === null || task.dias_restantes === undefined
      ? 'slate'
      : task.dias_restantes < 0
        ? 'red'
        : task.dias_restantes <= 2
          ? 'amber'
          : 'teal'

  const prioridadTone = task.prioridad === 'Alta' ? 'red' : task.prioridad === 'Media' ? 'amber' : 'teal'
  const estadoTone =
    task.estado === 'Completado'
      ? 'teal'
      : task.estado === 'Pendiente'
        ? 'amber'
        : task.estado === 'Cancelado'
          ? 'slate'
          : 'teal'

  return (
    <aside className={cn('grid h-full min-h-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_340px]', className)}>
      <div className="min-h-0 overflow-y-auto pr-1">
        <div className="space-y-5">
          <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.28),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.18),transparent_28%)]" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-teal-200">#{task.codigo_id ?? task.id}</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-9 tracking-[-0.04em] text-white sm:text-[2rem]">
                    {task.tarea}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {[task.seccion || 'Sin seccion', task.departamento || 'Sin departamento', task.responsable || 'Sin responsable'].join(' · ')}
                  </p>
                </div>
                <PrioridadBadge value={task.prioridad} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <EstadoBadge value={task.estado} />
                <TipoBadge value={task.tipo_tarea} />
                <SemaforoBadge value={task.semaforo} />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatusCard
              label="Prioridad"
              value={task.prioridad}
              icon={<Siren size={14} />}
              tone={prioridadTone}
            />
            <StatusCard
              label="Estado"
              value={task.estado}
              icon={task.estado === 'Completado' ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
              tone={estadoTone}
            />
            <StatusCard
              label="Vencimiento"
              value={tiempoRestante}
              icon={<AlertCircle size={14} />}
              tone={vencimientoTone}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DetailItem icon={<UserRound size={14} />} label="Responsable" value={task.responsable || 'Sin asignar'} />
            <DetailItem icon={<FolderKanban size={14} />} label="Tipo" value={task.tipo_tarea || 'Sin tipo'} />
            <DetailItem icon={<Hash size={14} />} label="Seccion" value={task.seccion || 'Sin seccion'} />
            <DetailItem icon={<CalendarDays size={14} />} label="Fecha inicio" value={formatDate(task.fecha_inicio)} />
            <DetailItem icon={<CalendarDays size={14} />} label="Fecha fin" value={formatDate(task.fecha_fin)} />
            <DetailItem icon={<ScrollText size={14} />} label="Tiempo restante" value={tiempoRestante} />
          </div>

          <InfoBlock icon={<FileText size={14} />} label="Descripcion">
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{task.tarea}</p>
          </InfoBlock>

          <InfoBlock icon={<ScrollText size={14} />} label="Notas de seguimiento">
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
              {task.notas?.trim() || 'Sin notas registradas para esta tarea.'}
            </p>
          </InfoBlock>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
        <div className="space-y-4">
          <section className="rounded-[28px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Avance actual
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                  {task.porcentaje_avance}%
                </p>
              </div>
              <div className="rounded-[22px] border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
                {task.estado}
              </div>
            </div>
            <ProgressBar value={task.porcentaje_avance} showLabel className="mt-5" size="md" />
          </section>

          <section className="rounded-[28px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Resumen operativo
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[20px] border border-white/80 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Semaforo</p>
                <div className="mt-2 text-sm font-semibold text-slate-800">
                  <SemaforoBadge value={task.semaforo} />
                </div>
              </div>
              <div className="rounded-[20px] border border-white/80 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ultima actualizacion</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(ultimaActividad)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Acciones
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button onClick={() => onOpenHistory(task)} className="action-btn w-full justify-center" title="Historial">
                <History size={14} />
                Historial
              </button>
              {canEditAgenda && (
                <>
                  <button onClick={() => onEdit(task)} className="action-btn w-full justify-center" title="Editar">
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(task)}
                    className="action-btn w-full justify-center text-rose-600"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </aside>
  )
}
