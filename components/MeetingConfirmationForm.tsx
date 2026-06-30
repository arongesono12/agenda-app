'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CalendarClock, CheckCircle2, Clock3, ExternalLink, Loader2, MapPin, XCircle } from 'lucide-react'
import type { ReunionRespuesta } from '@/lib/types'

type ConfirmationData = {
  invitacion: { nombre?: string | null; estado_respuesta: ReunionRespuesta; respondido_at?: string | null }
  reunion: {
    titulo: string
    descripcion?: string | null
    fecha_inicio: string
    fecha_fin?: string | null
    modalidad: string
    ubicacion?: string | null
    estado: string
    enlace_reunion?: string | null
    organismo_nombre: string
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Malabo',
  })
}

export default function MeetingConfirmationForm() {
  const token = useSearchParams().get('token') ?? ''
  const [data, setData] = useState<ConfirmationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<ReunionRespuesta | null>(null)
  const [error, setError] = useState('')

  const loadInvitation = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/reuniones/confirmar?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const result = (await response.json()) as { ok?: boolean; error?: string } & Partial<ConfirmationData>
      if (!response.ok || !result.ok || !result.invitacion || !result.reunion) {
        throw new Error(result.error ?? 'No se pudo cargar la invitacion.')
      }
      setData({ invitacion: result.invitacion, reunion: result.reunion })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la invitacion.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) void loadInvitation()
    else {
      setError('El enlace de confirmacion no contiene un token valido.')
      setLoading(false)
    }
  }, [loadInvitation, token])

  const respond = async (respuesta: ReunionRespuesta) => {
    setSaving(respuesta)
    setError('')
    try {
      const response = await fetch('/api/reuniones/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, respuesta }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string } & Partial<ConfirmationData>
      if (!response.ok || !result.ok || !result.invitacion || !result.reunion) {
        throw new Error(result.error ?? 'No se pudo guardar la respuesta.')
      }
      setData({ invitacion: result.invitacion, reunion: result.reunion })
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'No se pudo guardar la respuesta.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <section className="surface-panel-strong w-full max-w-2xl p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <CalendarClock size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Confirmacion de reunion</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Responde a tu invitacion</h1>
          </div>
        </div>

        {loading && <div className="mt-8 flex items-center gap-3 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Cargando invitacion...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {!loading && data && (
          <div className="mt-7 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{data.reunion.organismo_nombre}</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{data.reunion.titulo}</h2>
              {data.reunion.descripcion && <p className="mt-3 text-sm leading-6 text-slate-600">{data.reunion.descripcion}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <Clock3 size={17} className="mt-0.5 text-teal-700" />
                <span>{formatDate(data.reunion.fecha_inicio)}</span>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <MapPin size={17} className="mt-0.5 text-teal-700" />
                <span>{data.reunion.ubicacion || data.reunion.modalidad}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600">Respuesta actual: <strong className="text-slate-900">{data.invitacion.estado_respuesta}</strong></p>

            {data.reunion.estado === 'programada' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <button type="button" disabled={!!saving} onClick={() => void respond('confirmado')} className="action-btn-primary justify-center disabled:opacity-60">
                  {saving === 'confirmado' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Confirmar
                </button>
                <button type="button" disabled={!!saving} onClick={() => void respond('tentativo')} className="action-btn justify-center disabled:opacity-60">Tentativo</button>
                <button type="button" disabled={!!saving} onClick={() => void respond('rechazado')} className="action-btn-ghost justify-center text-rose-600 disabled:opacity-60">
                  <XCircle size={16} /> Rechazar
                </button>
              </div>
            )}

            {data.invitacion.estado_respuesta === 'confirmado' && data.reunion.enlace_reunion && (
              <a href={data.reunion.enlace_reunion} target="_blank" rel="noreferrer" className="action-btn-primary w-full justify-center">
                <ExternalLink size={16} /> Abrir reunion
              </a>
            )}
          </div>
        )}

        <Link href="/" className="action-btn-ghost mt-6 justify-center">Ir a la aplicacion</Link>
      </section>
    </main>
  )
}
