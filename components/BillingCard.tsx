'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, CreditCard } from 'lucide-react'
import PlanBadge from '@/components/PlanBadge'
import type { OrganismoSuscripcion } from '@/lib/types'

interface BillingCardProps {
  suscripcion: OrganismoSuscripcion | null
  organismoId: string
}

export default function BillingCard({ suscripcion, organismoId }: BillingCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const abrirPortal = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organismoId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al abrir el portal de facturación.')
      window.location.href = data.url
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  if (!suscripcion) {
    return (
      <div className="surface-panel-strong p-6">
        <p className="text-sm text-slate-500">Sin suscripción activa.</p>
      </div>
    )
  }

  const trialFin = suscripcion.trial_fin ? new Date(suscripcion.trial_fin) : null
  const diasRestantes = trialFin ? Math.max(0, Math.ceil((trialFin.getTime() - Date.now()) / 86400000)) : null

  return (
    <div className="surface-panel-strong overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Plan actual</p>
                <PlanBadge
                  planCodigo={suscripcion.plan_codigo}
                  estado={suscripcion.estado}
                  showEstado
                  className="mt-1"
                />
              </div>
            </div>

            {suscripcion.estado === 'prueba' && diasRestantes !== null && (
              <p className="mt-3 text-sm text-amber-600">
                {diasRestantes > 0
                  ? `Periodo de prueba: ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`
                  : 'El periodo de prueba ha finalizado.'}
              </p>
            )}

            {suscripcion.periodo_fin && suscripcion.estado === 'activa' && (
              <p className="mt-3 text-xs text-slate-500">
                Próxima renovación: {new Date(suscripcion.periodo_fin).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
      </div>

      {suscripcion.plan_codigo !== 'individual' && suscripcion.stripe_customer_id && (
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => void abrirPortal()}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Gestionar suscripción
          </button>
        </div>
      )}
    </div>
  )
}
