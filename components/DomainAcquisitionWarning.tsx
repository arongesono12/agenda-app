'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Clock3, Globe2, LockKeyhole, ShieldAlert } from 'lucide-react'
import { DOMAIN_ACQUISITION_DEADLINE } from '@/lib/domain-acquisition'

type TimeLeft = {
  total: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(now = Date.now()): TimeLeft {
  const total = Math.max(0, new Date(DOMAIN_ACQUISITION_DEADLINE).getTime() - now)
  const secondsTotal = Math.floor(total / 1000)
  const days = Math.floor(secondsTotal / 86400)
  const hours = Math.floor((secondsTotal % 86400) / 3600)
  const minutes = Math.floor((secondsTotal % 3600) / 60)
  const seconds = secondsTotal % 60

  return { total, days, hours, minutes, seconds }
}

function twoDigits(value: number) {
  return value.toString().padStart(2, '0')
}

export default function DomainAcquisitionWarning({
  nextPath = '/',
}: {
  nextPath?: string
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const expired = !!timeLeft && timeLeft.total <= 0
  const pending = !timeLeft
  const loginHref = useMemo(() => {
    const params = new URLSearchParams()
    if (nextPath && nextPath !== '/') params.set('next', nextPath)
    return `/login${params.toString() ? `?${params.toString()}` : ''}`
  }, [nextPath])

  useEffect(() => {
    setTimeLeft(getTimeLeft())
    const interval = window.setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const units = [
    { label: 'Dias', value: timeLeft?.days },
    { label: 'Horas', value: timeLeft?.hours },
    { label: 'Minutos', value: timeLeft?.minutes },
    { label: 'Segundos', value: timeLeft?.seconds },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0f0c] px-4 py-8 text-white sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(62,207,142,0.16),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(36,144,91,0.12),transparent_26%),linear-gradient(180deg,#0b0f0c_0%,#111714_56%,#080b09_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:44px_44px]" />

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="w-full overflow-hidden rounded-[28px] border border-[#2a3b32] bg-[#101712]/90 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="border-b border-[#26372f] bg-[#0f1712] px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2f5b43] bg-[#14241a] text-[#3ecf8e]">
                  <Globe2 size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#3ecf8e]">Aviso del dominio</p>
                  <p className="mt-1 text-sm text-[#9fb8aa]">Control previo de acceso</p>
                </div>
              </div>
              <span className={expired ? 'inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200' : 'inline-flex items-center gap-2 rounded-full border border-[#3ecf8e]/30 bg-[#3ecf8e]/10 px-3 py-1.5 text-xs font-semibold text-[#b8f7d7]'}>
                {expired ? <ShieldAlert size={14} /> : <Clock3 size={14} />}
                {expired ? 'Tiempo vencido' : 'Periodo activo'}
              </span>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2f5b43] bg-[#16231b] px-3 py-1 text-xs font-semibold text-[#b8f7d7]">
                <AlertTriangle size={14} />
                Advertencia importante
              </div>

              <h1 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-5xl">
                Validacion pendiente del tiempo de adquisicion del dominio
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#9fb8aa] sm:text-base">
                Esta pantalla se muestra antes del inicio de sesion para informar el estado del periodo de adquisicion. Mientras el contador siga activo, los usuarios pueden continuar al acceso del sistema.
              </p>

              {pending ? (
                <div className="mt-7 rounded-[22px] border border-[#2f5b43] bg-[#16231b] p-5 text-sm text-[#9fb8aa]">
                  Verificando tiempo restante...
                </div>
              ) : expired ? (
                <div className="mt-7 rounded-[22px] border border-red-500/30 bg-red-500/10 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={22} className="mt-0.5 flex-shrink-0 text-red-300" />
                    <div>
                      <p className="text-base font-semibold text-red-100">
                        El tiempo de adquisicion del dominio ya se vencio.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-red-100/75">
                        El acceso al inicio de sesion queda bloqueado hasta regularizar la adquisicion o renovacion del dominio.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  href={loginHref}
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3ecf8e] px-5 py-3 text-sm font-bold text-[#062015] shadow-[0_20px_50px_rgba(62,207,142,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#65e5aa]"
                >
                  Continuar al inicio de sesion
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>

            <div className="border-t border-[#26372f] bg-[#0d1410] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="rounded-[24px] border border-[#26372f] bg-[#101a14] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#3ecf8e]">Cuenta regresiva</p>
                    <p className="mt-2 text-sm text-[#9fb8aa]">Fecha limite: 07/05/2026</p>
                  </div>
                  <LockKeyhole size={20} className={expired ? 'text-red-300' : 'text-[#3ecf8e]'} />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {units.map((unit) => (
                    <div key={unit.label} className="rounded-2xl border border-[#26372f] bg-[#0b110d] p-4 text-center">
                      <p className={expired ? 'text-3xl font-semibold text-red-200' : 'text-3xl font-semibold text-white'}>
                        {unit.value === undefined ? '--' : twoDigits(unit.value)}
                      </p>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#789083]">
                        {unit.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#1c2a22]">
                  <div
                    className={expired ? 'h-full rounded-full bg-red-400' : 'h-full rounded-full bg-[#3ecf8e] transition-all'}
                    style={{ width: pending || expired ? '100%' : `${Math.max(4, Math.min(100, (timeLeft.total / (7 * 24 * 60 * 60 * 1000)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
