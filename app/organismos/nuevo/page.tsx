'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, ChevronDown, CreditCard, Landmark, Loader2, Wallet } from 'lucide-react'
import { PLANES } from '@/lib/billing/plans'
import type { PlanCodigo } from '@/lib/types'

const SECTORES = [
  'Tecnología', 'Salud', 'Educación', 'Finanzas', 'Construcción',
  'Comercio', 'Logística', 'Energía', 'Telecomunicaciones', 'Gobierno',
  'Servicios', 'Otro',
]

const METODOS_PAGO = [
  { codigo: 'tarjeta', nombre: 'Tarjeta / Stripe', descripcion: 'Disponible ahora', disponible: true, icon: CreditCard },
  { codigo: 'transferencia', nombre: 'Transferencia bancaria', descripcion: 'Proximamente', disponible: false, icon: Landmark },
  { codigo: 'muni_dinero', nombre: 'Muni Dinero', descripcion: 'Proximamente', disponible: false, icon: Wallet },
  { codigo: 'rosa_money', nombre: 'Rosa Money', descripcion: 'Proximamente', disponible: false, icon: Wallet },
]

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const planSeleccionado = PLANES.find((p) => p.codigo === planCodigo)
  const esGratis = planSeleccionado?.precioMensual === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

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

      // Plan de pago: lanzar checkout
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
