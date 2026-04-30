'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Settings,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  Building2,
  User,
  Tag,
  ShieldAlert,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/ui/PageHeader'
import { ESTADOS, TIPOS_TAREA, PRIORIDADES } from '@/lib/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useUserSession } from '@/components/UserSessionProvider'
import type { Responsable } from '@/lib/types'

interface Depto {
  id: number
  nombre: string
  activo: boolean
}

type DeleteTarget =
  | { type: 'depto'; id: number; label: string }
  | { type: 'resp'; id: number; label: string }
  | null

export default function CatalogosPage() {
  const { isAdmin } = useUserSession()
  const [deptos, setDeptos] = useState<Depto[]>([])
  const [resps, setResps] = useState<Responsable[]>([])
  const [loading, setLoading] = useState(true)
  const [newDepto, setNewDepto] = useState('')
  const [newResp, setNewResp] = useState({ nombre: '', email: '', departamento: '', cargo: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [tab, setTab] = useState<'deptos' | 'resps' | 'estados'>('deptos')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const usuariosPorDepartamento = useMemo(() => {
    return resps.reduce<Record<string, number>>((acc, responsable) => {
      const departamento = responsable.departamento?.trim()
      if (!departamento || !responsable.usuario_id) return acc
      acc[departamento] = (acc[departamento] ?? 0) + 1
      return acc
    }, {})
  }, [resps])

  const fetch = useCallback(async () => {
    setLoading(true)
    const [d, r] = await Promise.all([
      supabase.from('departamentos').select('*').order('nombre'),
      supabase.from('responsables').select('*').order('nombre'),
    ])
    setDeptos((d.data ?? []).map((row) => ({ id: row.id, nombre: row.nombre, activo: row.activo ?? true })))
    setResps((r.data ?? []).map((row) => ({ ...row, activo: row.activo ?? true })) as Responsable[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetch()
  }, [fetch])

  const addDepto = async () => {
    if (!newDepto.trim()) return
    setSaving(true)
    await supabase.from('departamentos').insert({ nombre: newDepto.trim() })
    setNewDepto('')
    setSaving(false)
    void fetch()
  }

  const addResp = async () => {
    if (!newResp.nombre.trim()) return
    const email = newResp.email.trim().toLowerCase()

    if (!email) {
      setFormError('El correo del responsable es obligatorio.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Introduce un correo valido.')
      return
    }

    setFormError('')
    setSaving(true)
    const { error } = await supabase.from('responsables').insert({
      nombre: newResp.nombre.trim(),
      email,
      departamento: newResp.departamento || null,
      cargo: newResp.cargo || null,
    })

    if (error) {
      setFormError(error.message)
      setSaving(false)
      return
    }

    setNewResp({ nombre: '', email: '', departamento: '', cargo: '' })
    setSaving(false)
    void fetch()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setDeleteError('')

    const query =
      deleteTarget.type === 'depto'
        ? supabase.from('departamentos').delete().eq('id', deleteTarget.id)
        : supabase.from('responsables').delete().eq('id', deleteTarget.id)

    const { error } = await query

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    setDeleteTarget(null)
    setDeleting(false)
    void fetch()
  }

  const tabs = [
    { key: 'deptos', label: 'Departamentos', icon: <Building2 size={15} /> },
    { key: 'resps', label: 'Responsables', icon: <User size={15} /> },
    { key: 'estados', label: 'Valores del sistema', icon: <Tag size={15} /> },
  ] as const

  if (!isAdmin) {
    return (
      <div className="page-stack">
        <PageHeader
          title="Catalogos"
          subtitle="Modulo reservado para administradores del sistema."
          icon={<Settings size={22} />}
        />
        <div className="surface-panel-strong mx-auto max-w-3xl p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldAlert size={28} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">Permisos insuficientes</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
            Solo los usuarios administradores pueden crear, editar o eliminar catalogos maestros.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Catalogos"
        subtitle="Gestiona listas maestras y referencias base del sistema para mantener consistencia operativa."
        icon={<Settings size={22} />}
        actions={
          <button onClick={() => void fetch()} className="action-btn h-12 w-12 rounded-2xl p-0">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="surface-panel w-full overflow-x-auto p-2">
        <div className="inline-flex min-w-full gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={tab === t.key ? 'action-btn-primary min-w-max px-4 py-2.5' : 'action-btn min-w-max border-transparent bg-transparent px-4 py-2.5 shadow-none'}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'deptos' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="surface-panel overflow-hidden">
            <div className="border-b border-white/70 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Departamentos ({deptos.length})</p>
            </div>
            {loading ? (
              <div className="py-16 text-center"><RefreshCw size={20} className="mx-auto animate-spin text-teal-600" /></div>
            ) : (
              <ul className="divide-y divide-slate-100/80">
                {deptos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                        <Building2 size={16} />
                      </div>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 px-2 text-xs font-bold text-teal-700">
                        {usuariosPorDepartamento[d.nombre] ?? 0}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{d.nombre}</span>
                    </div>
                    <button
                      onClick={() => {
                        setDeleteError('')
                        setDeleteTarget({ type: 'depto', id: d.id, label: d.nombre })
                      }}
                      className="action-btn h-10 w-10 rounded-2xl p-0 text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface-panel p-5">
            <p className="label-field">Nuevo registro</p>
            <h3 className="text-lg font-semibold text-slate-900">Agregar departamento</h3>
            <p className="mt-1 text-sm text-slate-500">Crea una nueva area para clasificar tareas y responsables.</p>
            <div className="mt-5 space-y-3">
              <input
                type="text"
                value={newDepto}
                onChange={(e) => setNewDepto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDepto()}
                placeholder="Nombre del departamento"
                className="input-shell"
              />
              <button onClick={addDepto} disabled={saving || !newDepto.trim()} className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Agregar departamento
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'resps' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="surface-panel overflow-hidden">
            <div className="border-b border-white/70 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Responsables ({resps.length})</p>
            </div>
            {loading ? (
              <div className="py-16 text-center"><RefreshCw size={20} className="mx-auto animate-spin text-teal-600" /></div>
            ) : (
              <ul className="divide-y divide-slate-100/80">
                {resps.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/5 text-sm font-semibold text-slate-700">
                        {r.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{r.nombre}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[r.cargo, r.departamento].filter(Boolean).join(' · ') || 'Sin detalle adicional'}
                        </p>
                        {r.email && <p className="truncate text-xs text-slate-500">{r.email}</p>}
                        <p className={r.usuario_id ? 'mt-1 text-xs font-semibold text-teal-600' : 'mt-1 text-xs font-semibold text-amber-600'}>
                          {r.usuario_id ? 'Usuario asociado' : 'Sin usuario asociado'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setDeleteError('')
                        setDeleteTarget({ type: 'resp', id: r.id, label: r.nombre })
                      }}
                      className="action-btn h-10 w-10 rounded-2xl p-0 text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="surface-panel p-5">
            <p className="label-field">Nuevo registro</p>
            <h3 className="text-lg font-semibold text-slate-900">Agregar responsable</h3>
            <p className="mt-1 text-sm text-slate-500">Asocia nombre, correo, cargo y departamento para asignacion mas clara.</p>
            <div className="mt-5 space-y-3">
              {formError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              )}
              <input
                type="text"
                value={newResp.nombre}
                onChange={(e) => setNewResp((r) => ({ ...r, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="input-shell"
              />
              <input
                type="email"
                value={newResp.email}
                onChange={(e) => setNewResp((r) => ({ ...r, email: e.target.value }))}
                placeholder="Correo del responsable"
                className="input-shell"
              />
              <input
                type="text"
                value={newResp.cargo}
                onChange={(e) => setNewResp((r) => ({ ...r, cargo: e.target.value }))}
                placeholder="Cargo"
                className="input-shell"
              />
              <select
                value={newResp.departamento}
                onChange={(e) => setNewResp((r) => ({ ...r, departamento: e.target.value }))}
                className="input-shell"
              >
                <option value="">Seleccionar departamento</option>
                {deptos.map((d) => (
                  <option key={d.id}>{d.nombre}</option>
                ))}
              </select>
              <button onClick={addResp} disabled={saving || !newResp.nombre.trim() || !newResp.email.trim()} className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                Agregar responsable
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'estados' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            { title: 'Estados de tarea', values: ESTADOS, color: 'bg-sky-50 text-sky-700 border-sky-200' },
            { title: 'Prioridades', values: PRIORIDADES, color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { title: 'Tipos de tarea', values: TIPOS_TAREA, color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
          ].map(({ title, values, color }) => (
            <div key={title} className="surface-panel p-5">
              <p className="label-field">Referencia</p>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <ul className="mt-5 space-y-3">
                {values.map((value) => (
                  <li key={value} className={`badge w-full justify-start rounded-2xl px-4 py-3 ${color}`}>
                    {value}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-slate-500">Estos valores forman parte del lenguaje base del sistema.</p>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'depto' ? 'Eliminar departamento' : 'Eliminar responsable'}
        description="Confirma la eliminacion antes de modificar un catalogo maestro del sistema."
        confirmLabel={deleteTarget?.type === 'depto' ? 'Si, eliminar departamento' : 'Si, eliminar responsable'}
        loading={deleting}
        error={deleteError}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (deleting) return
          setDeleteError('')
          setDeleteTarget(null)
        }}
      >
        {deleteTarget && (
          <div className="rounded-[24px] border border-white/80 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Registro seleccionado
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{deleteTarget.label}</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
