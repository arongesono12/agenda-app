'use client'

import { useState } from 'react'
import { X, Send, Loader2, ChevronDown } from 'lucide-react'
import type { RolCodigo } from '@/lib/types'

const ROLES: { value: RolCodigo; label: string; desc: string }[] = [
  { value: 'supervisor', label: 'Supervisor', desc: 'Puede gestionar tareas y miembros' },
  { value: 'responsable', label: 'Responsable', desc: 'Puede crear y editar tareas' },
  { value: 'consulta', label: 'Consulta', desc: 'Solo lectura' },
]

interface InvitarMiembroModalProps {
  slug: string
  onClose: () => void
  onInvited: () => void
}

export default function InvitarMiembroModal({ slug, onClose, onInvited }: InvitarMiembroModalProps) {
  const [email, setEmail] = useState('')
  const [rolCodigo, setRolCodigo] = useState<RolCodigo>('responsable')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/organismos/${slug}/invitaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), rolCodigo }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al enviar la invitación.')
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_32px_64px_rgba(15,23,42,0.16)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Invitar miembro</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <Send size={22} />
            </div>
            <p className="font-semibold text-slate-900">Invitación enviada</p>
            <p className="mt-1 text-sm text-slate-500">Se ha enviado un correo a <strong>{email}</strong>.</p>
            <button
              type="button"
              onClick={onInvited}
              className="mt-6 rounded-2xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label className="label-field">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-shell"
                placeholder="nombre@empresa.com"
                autoFocus
              />
            </div>

            <div>
              <label className="label-field">Rol</label>
              <div className="relative">
                <select
                  value={rolCodigo}
                  onChange={(e) => setRolCodigo(e.target.value as RolCodigo)}
                  className="input-shell appearance-none pr-10"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Enviar invitación
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
