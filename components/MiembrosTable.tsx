'use client'

import { useState } from 'react'
import { ChevronDown, Trash2, Loader2 } from 'lucide-react'
import UserAvatar from '@/components/ui/UserAvatar'
import type { MiembroConPerfil, RolCodigo } from '@/lib/types'

const ROLES: { value: RolCodigo; label: string }[] = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'administradora', label: 'Administradora' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'responsable', label: 'Responsable' },
  { value: 'consulta', label: 'Consulta' },
]

const ROL_COLORS: Record<RolCodigo, string> = {
  administrador: 'bg-purple-50 text-purple-700 border-purple-200',
  administradora: 'bg-purple-50 text-purple-700 border-purple-200',
  supervisor: 'bg-teal-50 text-teal-700 border-teal-200',
  responsable: 'bg-blue-50 text-blue-700 border-blue-200',
  consulta: 'bg-slate-100 text-slate-600 border-slate-200',
}

interface MiembrosTableProps {
  miembros: MiembroConPerfil[]
  loading: boolean
  slug: string
  esAdmin: boolean
  onUpdated: () => void
}

export default function MiembrosTable({ miembros, loading, slug, esAdmin, onUpdated }: MiembrosTableProps) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  const changeRole = async (usuarioId: string, rolCodigo: RolCodigo) => {
    setUpdating(usuarioId)
    setError('')
    try {
      const res = await fetch(`/api/organismos/${slug}/miembros`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId, rolCodigo }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al actualizar rol.')
      onUpdated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
    } finally {
      setUpdating(null)
    }
  }

  const removeMember = async (usuarioId: string) => {
    if (!confirm('¿Eliminar este miembro del organismo?')) return
    setDeleting(usuarioId)
    setError('')
    try {
      const res = await fetch(`/api/organismos/${slug}/miembros?usuarioId=${usuarioId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al eliminar miembro.')
      onUpdated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="surface-panel-strong flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="surface-panel-strong overflow-hidden">
      {error && (
        <div className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-sm text-rose-700">{error}</div>
      )}

      {miembros.length === 0 ? (
        <div className="py-16 text-center text-sm text-slate-400">No hay miembros.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {miembros.map((m) => {
            const nombre = m.perfil?.nombre_completo?.trim() || m.perfil?.email?.split('@')[0] || 'Usuario'
            const email = m.perfil?.email ?? ''
            const avatarUrl = m.perfil?.avatar_url ?? null
            const isUpdating = updating === m.usuario_id
            const isDeleting = deleting === m.usuario_id

            return (
              <div key={m.usuario_id} className="flex items-center gap-4 px-6 py-4">
                <UserAvatar name={nombre} avatarUrl={avatarUrl} size="md" className="h-10 w-10 flex-shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{nombre}</p>
                  <p className="truncate text-xs text-slate-500">{email}</p>
                </div>

                {esAdmin ? (
                  <div className="relative">
                    <select
                      value={m.rol_codigo}
                      onChange={(e) => void changeRole(m.usuario_id, e.target.value as RolCodigo)}
                      disabled={isUpdating || isDeleting}
                      className={`appearance-none rounded-full border py-1 pl-3 pr-7 text-xs font-semibold transition-all focus:outline-none disabled:opacity-60 ${ROL_COLORS[m.rol_codigo]}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60" />
                    {isUpdating && <Loader2 size={12} className="absolute -right-5 top-1/2 -translate-y-1/2 animate-spin text-teal-500" />}
                  </div>
                ) : (
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${ROL_COLORS[m.rol_codigo]}`}>
                    {ROLES.find((r) => r.value === m.rol_codigo)?.label ?? m.rol_codigo}
                  </span>
                )}

                {esAdmin && (
                  <button
                    type="button"
                    onClick={() => void removeMember(m.usuario_id)}
                    disabled={isUpdating || isDeleting}
                    className="ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                    aria-label="Eliminar miembro"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
