'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { supabase } from '@/lib/supabase'

export default function LoginForm({ nextPath = '/' }: { nextPath?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(signInError.message || 'No se pudo iniciar sesión. Verifica el correo y la contraseña.')
      setSubmitting(false)
      return
    }

    router.replace(nextPath)
    router.refresh()
  }

  return (
    <div className="grid w-full max-w-md grid-cols-1 gap-6 lg:max-w-6xl lg:grid-cols-[1.1fr_0.9fr]">
      <section className="surface-panel-dark relative hidden overflow-hidden p-6 text-white sm:p-8 lg:block lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_34%)]" />
        <div className="relative flex h-full flex-col justify-between gap-8">
          <div>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
              Acceso seguro
            </span>
            <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              Agenda de control con acceso autenticado para el equipo
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Inicia sesión para consultar tareas, cronogramas, historial y paneles de seguimiento con una capa real de autenticación.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              'Protección de acceso a todas las rutas',
              'Sesión persistente con cookies seguras',
              'Datos visibles solo para usuarios autenticados',
            ].map((item) => (
              <div key={item} className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
                <p className="text-sm font-semibold text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-panel-strong overflow-hidden p-5 sm:p-6 lg:p-8">
        <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="logo-panel relative h-16 w-16 overflow-hidden rounded-[24px] border shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
                <Image
                  src="/logo/Icon-S.png"
                  alt="Logo de SEGESA"
                  fill
                  sizes="64px"
                  className="object-contain p-2"
                  priority
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">SEGESA</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">Iniciar sesión</p>
              </div>
            </div>
            <ThemeToggle className="w-11 px-0 sm:w-auto sm:px-3" />
          </div>

          <p className="mb-6 text-sm leading-6 text-slate-500">
            Usa tus credenciales corporativas para acceder al sistema de agenda y seguimiento.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div>
              <label className="label-field">Correo corporativo</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="input-shell pl-11"
                  placeholder="usuario@segesa.gq"
                />
              </div>
            </div>

            <div>
              <label className="label-field">Contraseña</label>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="input-shell pl-11 pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="action-btn-primary mt-2 w-full justify-center disabled:translate-y-0 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
              {submitting ? 'Validando acceso...' : 'Entrar al sistema'}
            </button>
          </form>

          <div className="mt-5 rounded-[22px] border border-white/80 bg-slate-50/80 px-4 py-3 text-center">
            <p className="text-sm text-slate-600">
              No tienes cuenta?{' '}
              <Link href="/registro" className="font-semibold text-teal-700 transition-colors hover:text-teal-900">
                Registrarse
              </Link>
            </p>
          </div>

        </div>
      </section>
    </div>
  )
}
