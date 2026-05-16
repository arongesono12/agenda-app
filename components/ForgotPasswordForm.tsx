'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/actualizar-password`,
      })

      if (resetError) throw resetError

      setSuccess('Si el correo existe en el sistema, recibira un enlace seguro para crear una nueva contrasena.')
      setEmail('')
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo enviar el enlace de recuperacion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid w-full max-w-md grid-cols-1 gap-6 lg:max-w-5xl lg:grid-cols-[0.95fr_1.05fr]">
      <section className="surface-panel-dark relative hidden overflow-hidden p-6 text-white sm:p-8 lg:block lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_34%)]" />
        <div className="relative flex h-full flex-col justify-between gap-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
              <ShieldCheck size={14} />
              Recuperacion segura
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              Restaura el acceso sin compartir credenciales
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              El sistema enviara un enlace temporal al correo corporativo para que el usuario defina una nueva contrasena.
            </p>
          </div>

          <div className="grid gap-4">
            {[
              'No se muestran contrasenas anteriores',
              'El enlace expira segun la configuracion de Supabase',
              'El usuario vuelve al login despues de actualizarla',
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
                <Image src="/logo/Icon-S.png" alt="Logo de SEGESA" fill sizes="64px" className="object-contain p-2" priority />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">SEGESA</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">Recuperar contrasena</p>
              </div>
            </div>
            <ThemeToggle className="w-11 px-0 sm:w-auto sm:px-3" />
          </div>

          <p className="mb-6 text-sm leading-6 text-slate-500">
            Introduce el correo de la cuenta. Si esta registrado, recibira instrucciones para restablecer el acceso.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{success}</span>
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

            <button
              type="submit"
              disabled={submitting}
              className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {submitting ? 'Enviando enlace...' : 'Enviar enlace de recuperacion'}
            </button>
          </form>

          <Link href="/login" className="action-btn-ghost mt-4 justify-center">
            <ArrowLeft size={16} />
            Volver al login
          </Link>
        </div>
      </section>
    </div>
  )
}
