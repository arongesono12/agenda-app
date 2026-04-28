'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration: number
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { icon: ReactNode; bar: string; bg: string; border: string; text: string; label: string }
> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    bar: 'bg-teal-500',
    bg: 'bg-white/80',
    border: 'border-teal-200/70',
    text: 'text-teal-700',
    label: 'text-slate-800',
  },
  error: {
    icon: <XCircle size={18} />,
    bar: 'bg-rose-500',
    bg: 'bg-white/80',
    border: 'border-rose-200/70',
    text: 'text-rose-600',
    label: 'text-slate-800',
  },
  info: {
    icon: <Info size={18} />,
    bar: 'bg-sky-500',
    bg: 'bg-white/80',
    border: 'border-sky-200/70',
    text: 'text-sky-600',
    label: 'text-slate-800',
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    bar: 'bg-amber-500',
    bg: 'bg-white/80',
    border: 'border-amber-200/70',
    text: 'text-amber-600',
    label: 'text-slate-800',
  },
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = TOAST_CONFIG[toast.type]
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 320)
  }, [onDismiss, toast.id])

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, toast.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dismiss, toast.duration])

  return (
    <div
      style={{
        animation: exiting
          ? 'toastOut 0.32s cubic-bezier(0.4,0,1,1) forwards'
          : 'toastIn 0.36s cubic-bezier(0.175,0.885,0.32,1.275) forwards',
      }}
      className={`relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-[20px] border ${cfg.border} ${cfg.bg} p-4 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl`}
      role="alert"
      aria-live="assertive"
    >
      {/* coloured progress bar */}
      <span
        className={`absolute bottom-0 left-0 h-[3px] ${cfg.bar} rounded-full`}
        style={{
          width: '100%',
          animation: `toastBar ${toast.duration}ms linear forwards`,
        }}
      />

      {/* icon */}
      <span className={`mt-0.5 flex-shrink-0 ${cfg.text}`}>{cfg.icon}</span>

      {/* message */}
      <p className={`flex-1 text-sm font-medium leading-5 ${cfg.label}`}>{toast.message}</p>

      {/* close */}
      <button
        onClick={dismiss}
        className="flex-shrink-0 rounded-xl p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        aria-label="Cerrar notificación"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }])
  }, [])

  const value: ToastContextValue = {
    success: (msg, dur) => push('success', msg, dur),
    error: (msg, dur) => push('error', msg, dur),
    info: (msg, dur) => push('info', msg, dur),
    warning: (msg, dur) => push('warning', msg, dur),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Portal-like fixed container */}
      <div
        aria-label="Notificaciones"
        className="no-print pointer-events-none fixed bottom-6 right-5 z-[200] flex flex-col-reverse gap-3 sm:right-6"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>

      {/* Keyframes injected once */}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(8px) scale(0.96); }
        }
        @keyframes toastBar {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
