'use client'

import { useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Tarea } from '@/lib/types'
import TaskDetailPanel from '@/components/TaskDetailPanel'

interface TaskDetailModalProps {
  task: Tarea | null
  isClosing: boolean
  currentIndex: number
  totalTasks: number
  canGoPrev: boolean
  canGoNext: boolean
  canEditAgenda: boolean
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  onEdit: (task: Tarea) => void
  onDelete: (task: Tarea) => void
  onOpenHistory: (task: Tarea) => void
}

export default function TaskDetailModal({
  task,
  isClosing,
  currentIndex,
  totalTasks,
  canGoPrev,
  canGoNext,
  canEditAgenda,
  onClose,
  onPrev,
  onNext,
  onEdit,
  onDelete,
  onOpenHistory,
}: TaskDetailModalProps) {
  useEffect(() => {
    if (!task) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && canGoPrev) onPrev()
      if (event.key === 'ArrowRight' && canGoNext) onNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [task, onClose, canGoPrev, canGoNext, onPrev, onNext])

  if (!task) return null

  return (
    <div
      className={`agenda-modal-overlay ${isClosing ? 'detail-modal-backdrop-out' : 'detail-modal-backdrop'}`}
      onClick={onClose}
    >
      <div
        className={`agenda-modal-shell agenda-modal-shell-wide flex h-auto flex-col ${isClosing ? 'detail-modal-panel-out' : 'detail-modal-panel'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-white/70 px-5 py-4 sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_35%),radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_28%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">
                Vista de detalle
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays size={15} />
                <span className="truncate">
                  {currentIndex >= 0 ? `Tarea ${currentIndex + 1} de ${totalTasks}` : 'Consulta completa de la tarea seleccionada'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                onClick={onPrev}
                disabled={!canGoPrev}
                className="action-btn h-11 min-w-11 rounded-2xl px-3 disabled:translate-y-0 disabled:opacity-45"
                aria-label="Tarea anterior"
                title="Tarea anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={onNext}
                disabled={!canGoNext}
                className="action-btn h-11 min-w-11 rounded-2xl px-3 disabled:translate-y-0 disabled:opacity-45"
                aria-label="Tarea siguiente"
                title="Tarea siguiente"
              >
                <ChevronRight size={16} />
              </button>
            <button
              onClick={onClose}
              className="agenda-modal-close"
              aria-label="Cerrar detalle"
            >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <TaskDetailPanel
          task={task}
          canEditAgenda={canEditAgenda}
          onEdit={onEdit}
          onDelete={onDelete}
          onOpenHistory={onOpenHistory}
          className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 lg:p-6"
        />
      </div>
    </div>
  )
}
