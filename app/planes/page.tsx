import Link from 'next/link'
import { Check } from 'lucide-react'
import { PLANES } from '@/lib/billing/plans'

function PrecioFormato({ centimos }: { centimos: number }) {
  if (centimos === 0) return <span>Gratis</span>
  return <span>{centimos} €<span className="text-sm font-normal text-slate-500">/mes</span></span>
}

export default function PlanesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">Planes</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Elige tu plan
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            14 días de prueba gratuita en todos los planes de pago. Sin compromiso.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {PLANES.map((plan) => (
            <div
              key={plan.codigo}
              className={`relative rounded-3xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                plan.destacado
                  ? 'border-teal-300 ring-2 ring-teal-300 ring-offset-2'
                  : 'border-slate-200'
              }`}
            >
              {plan.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">{plan.nombre}</h2>
                <p className="mt-1 text-sm text-slate-500">{plan.descripcion}</p>
                <div className="mt-4 text-3xl font-bold text-slate-900">
                  <PrecioFormato centimos={plan.precioMensual} />
                </div>
                {plan.precioMensual > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    o {plan.precioAnual} €/año (ahorra {Math.round(100 - (plan.precioAnual / (plan.precioMensual * 12)) * 100)}%)
                  </p>
                )}
              </div>

              <ul className="mb-8 space-y-3">
                {plan.caracteristicas.map((caracteristica) => (
                  <li key={caracteristica} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={15} className="mt-0.5 flex-shrink-0 text-teal-500" />
                    {caracteristica}
                  </li>
                ))}
              </ul>

              <Link
                href={`/organismos/nuevo?plan=${plan.codigo}`}
                className={`block w-full rounded-2xl py-3 text-center text-sm font-semibold transition-all ${
                  plan.destacado
                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                {plan.precioMensual === 0 ? 'Empezar gratis' : 'Empezar prueba gratis'}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-teal-600 hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
