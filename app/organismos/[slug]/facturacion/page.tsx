'use client'

import { useEffect, useState, use } from 'react'
import { CreditCard, Loader2, FileText, ExternalLink, ShieldCheck } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import BillingCard from '@/components/BillingCard'
import PlanBadge from '@/components/PlanBadge'
import { useUserSession } from '@/components/UserSessionProvider'
import { ADMIN_ROLE_CODES } from '@/lib/access-control'
import { SEGESA_ORGANISMO_ID } from '@/lib/organismo-access'
import type { OrganismoFactura } from '@/lib/types'

export default function FacturacionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { organismoActivo, suscripcion, rolEnOrganismo } = useUserSession()
  const esAdmin = rolEnOrganismo && ADMIN_ROLE_CODES.includes(rolEnOrganismo as (typeof ADMIN_ROLE_CODES)[number])
  const esSegesa = organismoActivo?.id === SEGESA_ORGANISMO_ID

  const [facturas, setFacturas] = useState<OrganismoFactura[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/organismos/${slug}/facturas`)
        if (res.ok) {
          const data = await res.json()
          setFacturas(data.facturas ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [slug])

  const formatImporte = (centimos: number, moneda: string) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda.toUpperCase() }).format(centimos / 100)
  }

  return (
    <div className="page-layout">
      <PageHeader
        title="Facturación"
        subtitle="Gestiona tu suscripción e historial de facturas."
        icon={<CreditCard size={22} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Suscripción activa</h2>
          {esSegesa ? (
            <div className="surface-panel-strong p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <PlanBadge planCodigo="empresa" estado="activa" showEstado />
                  <p className="mt-2 text-sm font-semibold text-slate-900">Segesa esta exento de pagos.</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Este organo funciona fuera del flujo de membresias y facturacion. No se solicitara compra, checkout ni portal de pagos a sus miembros.
              </p>
            </div>
          ) : !esAdmin ? (
            <div className="surface-panel-strong p-6">
              <div className="flex items-center gap-3">
                <PlanBadge planCodigo={suscripcion?.plan_codigo} estado={suscripcion?.estado} showEstado />
              </div>
              <p className="mt-3 text-sm text-slate-500">Solo los administradores pueden gestionar la facturación.</p>
            </div>
          ) : (
            <BillingCard suscripcion={suscripcion} organismoId={organismoActivo?.id ?? ''} />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Historial de facturas</h2>
          <div className="surface-panel-strong overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-teal-500" />
              </div>
            ) : facturas.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Sin facturas todavía.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {facturas.map((f) => (
                  <div key={f.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{formatImporte(f.importe_centimos, f.moneda)}</p>
                      {f.fecha_emision && (
                        <p className="text-xs text-slate-500">
                          {new Date(f.fecha_emision).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      f.estado === 'pagada'
                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                        : f.estado === 'pendiente'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}>
                      {f.estado.charAt(0).toUpperCase() + f.estado.slice(1)}
                    </span>
                    {f.pdf_url && (
                      <a
                        href={f.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
