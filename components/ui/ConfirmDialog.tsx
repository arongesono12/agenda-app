'use client'

import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  error?: string
  children?: ReactNode
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  error = '',
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [loading, onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-md sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Cerrar confirmacion"
        className="absolute inset-0"
        onClick={() => {
          if (!loading) onClose()
        }}
      />

      <div className="surface-panel-strong relative w-full max-w-xl overflow-hidden rounded-[28px]">
        <div className="relative overflow-hidden border-b border-white/70 bg-gradient-to-br from-rose-950 via-slate-950 to-slate-900 px-5 py-5 text-white sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.18),transparent_42%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[20px] bg-white/10 text-rose-100">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-100/80">
                  Confirmacion de seguridad
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">{title}</h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">{description}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {children}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 px-4 py-4 text-sm text-rose-800">
            Esta accion eliminara el registro de forma permanente y quedara reflejada en el historial.
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="action-btn-ghost flex-1 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(225,29,72,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-700 disabled:translate-y-0 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
              {loading ? 'Eliminando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
