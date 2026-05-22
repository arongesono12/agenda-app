'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, CheckCircle2, ChevronDown, CreditCard, Landmark, Loader2, Wallet } from 'lucide-react'
import { PLANES } from '@/lib/billing/plans'
import type { PlanCodigo } from '@/lib/types'

const SECTORES = [
  'Tecnología', 'Salud', 'Educación', 'Finanzas', 'Construcción',
  'Comercio', 'Logística', 'Energía', 'Telecomunicaciones', 'Gobierno',
  'Servicios', 'Otro',
]

const METODOS_PAGO = [
  { codigo: 'tarjeta', nombre: 'Tarjeta / Stripe', descripcion: 'Disponible ahora', disponible: true, icon: CreditCard },
  { codigo: 'transferencia', nombre: 'Transferencia bancaria', descripcion: 'Genera una referencia de pago', disponible: true, icon: Landmark },
  { codigo: 'muni_dinero', nombre: 'Muni Dinero', descripcion: 'Proximamente', disponible: false, icon: Wallet },
  { codigo: 'rosa_money', nombre: 'Rosa Money', descripcion: 'Proximamente', disponible: false, icon: Wallet },
]

type TransferenciaInfo = {
  referencia: string
  importeCentimos: number
  moneda: string
  beneficiario: string
  banco: string
  cuenta: string
  iban?: string | null
  swift?: string | null
  concepto: string
  vencimiento: string
}

function NuevoOrganismoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planInicial = (searchParams.get('plan') ?? 'basico') as PlanCodigo

  const [nombre, setNombre] = useState('')
  const [sector, setSector] = useState('')
  const [tipo, setTipo] = useState<'individual' | 'corporativo'>('corporativo')
  const [planCodigo, setPlanCodigo] = useState<PlanCodigo>(planInicial)
  const [intervalo, setIntervalo] = useState<'mensual' | 'anual'>('mensual')
  const [metodoPago, setMetodoPago] = useState('tarjeta')
  const [transferencia, setTransferencia] = useState<TransferenciaInfo | null>(null)
  const [dashboardUrl, setDashboardUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const planSeleccionado = PLANES.find((p) => p.codigo === planCodigo)
  const esGratis = planSeleccionado?.precioMensual === 0
  const formatMoney = (centimos: number, moneda: string) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda.toUpperCase() }).format(centimos / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setTransferencia(null)

    try {
      const res = await fetch('/api/organismos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), tipo, sector, planCodigo, intervalo }),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al crear el organismo.')

      if (data.redirect) {
        router.replace(data.redirect)
        return
      }

      if (metodoPago === 'transferencia') {
        const transferenciaRes = await fetch('/api/billing/bank-transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organismoId: data.organismo.id,
            planCodigo,
            intervalo,
          }),
        })
        const transferenciaData = await transferenciaRes.json()

        if (!transferenciaRes.ok || !transferenciaData.ok) {
          throw new Error(transferenciaData.error || 'Error al generar la transferencia bancaria.')
        }

        setTransferencia(transferenciaData.instrucciones)
        setDashboardUrl(transferenciaData.redirect || `/organismos/${data.organismo.slug}/dashboard`)
        return
      }

      // Plan de pago: lanzar checkout con tarjeta.
      const checkoutRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organismoId: data.organismo.id,
          planCodigo,
          intervalo,
        }),
      })
      const checkoutData = await checkoutRes.json()

      if (!checkoutRes.ok || !checkoutData.ok) throw new Error(checkoutData.error || 'Error al iniciar el pago.')

      window.location.href = checkoutData.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100">
            <Building2 size={22} className="text-teal-700" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Crear organismo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configura tu espacio de trabajo y elige el plan adecuado.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {transferencia && (
          <div className="mb-6 rounded-3xl border border-teal-200 bg-teal-50 p-5 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-teal-700">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Transferencia bancaria generada</p>
                <p className="mt-1 text-slate-600">
                  Realiza el pago con la referencia indicada. Tu organismo queda en periodo de verificacion mientras se confirma la transferencia.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-white/80 bg-white/70 p-4">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Importe</span>
                <span className="font-semibold text-slate-900">{formatMoney(transferencia.importeCentimos, transferencia.moneda)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Referencia</span>
                <span className="font-semibold text-slate-900">{transferencia.referencia}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Beneficiario</span>
                <span className="text-right font-semibold text-slate-900">{transferencia.beneficiario}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Banco</span>
                <span className="text-right font-semibold text-slate-900">{transferencia.banco}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Cuenta</span>
                <span className="text-right font-semibold text-slate-900">{transferencia.cuenta}</span>
              </div>
              {transferencia.iban && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">IBAN</span>
                  <span className="text-right font-semibold text-slate-900">{transferencia.iban}</span>
                </div>
              )}
              {transferencia.swift && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">SWIFT</span>
                  <span className="text-right font-semibold text-slate-900">{transferencia.swift}</span>
                </div>
              )}
              <div className="border-t border-slate-100 pt-3">
                <span className="block text-slate-500">Concepto</span>
                <span className="mt-1 block font-semibold text-slate-900">{transferencia.concepto}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.replace(dashboardUrl || '/dashboard')}
              className="action-btn-primary mt-4 w-full justify-center"
            >
              Ir al dashboard
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label-field">Nombre del organismo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
              className="input-shell"
              placeholder="Ej. Acme Corp"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Tipo</label>
              <div className="relative">
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as 'individual' | 'corporativo')}
                  className="input-shell appearance-none pr-10"
                >
                  <option value="corporativo">Corporativo</option>
                  <option value="individual">Individual</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="label-field">Sector</label>
              <div className="relative">
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="input-shell appearance-none pr-10"
                >
                  <option value="">Seleccionar</option>
                  {SECTORES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="label-field">Plan</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLANES.map((plan) => (
                <button
                  key={plan.codigo}
                  type="button"
                  onClick={() => setPlanCodigo(plan.codigo)}
                  className={`rounded-2xl border px-3 py-3 text-center text-xs font-semibold transition-all ${
                    planCodigo === plan.codigo
                      ? 'border-teal-400 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:border-teal-300'
                  }`}
                >
                  <div>{plan.nombre}</div>
                  <div className="mt-1 text-[11px] font-normal opacity-70">
                    {plan.precioMensual === 0 ? 'Gratis' : `${plan.precioMensual} €/mes`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {!esGratis && (
            <div className="space-y-4">
              <div>
                <label className="label-field">Facturacion</label>
                <div className="flex gap-3">
                  {(['mensual', 'anual'] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIntervalo(i)}
                      className={`flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all capitalize ${
                        intervalo === i
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-slate-200 text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {i}
                      {i === 'anual' && <span className="ml-1 text-xs text-teal-500">(ahorra ~17%)</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-field">Metodo de pago</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {METODOS_PAGO.map((metodo) => {
                    const Icon = metodo.icon
                    const activo = metodoPago === metodo.codigo

                    return (
                      <button
                        key={metodo.codigo}
                        type="button"
                        onClick={() => metodo.disponible && setMetodoPago(metodo.codigo)}
                        disabled={!metodo.disponible}
                        className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                          activo
                            ? 'border-teal-400 bg-teal-50 text-teal-800'
                            : metodo.disponible
                              ? 'border-slate-200 text-slate-700 hover:border-teal-300'
                              : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                          activo ? 'bg-teal-100 text-teal-700' : 'bg-white text-slate-400'
                        }`}>
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{metodo.nombre}</span>
                          <span className="block text-xs">{metodo.descripcion}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !nombre.trim()}
            className="action-btn-primary w-full justify-center disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            {loading
              ? 'Procesando...'
              : esGratis
              ? 'Crear organismo'
              : metodoPago === 'transferencia'
              ? 'Crear y generar transferencia'
              : 'Crear y continuar al pago'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NuevoOrganismoPage() {
  return (
    <Suspense>
      <NuevoOrganismoForm />
    </Suspense>
  )
}
