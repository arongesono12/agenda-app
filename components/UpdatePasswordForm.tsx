'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { supabase } from '@/lib/supabase'

export default function UpdatePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const prepareRecoverySession = async () => {
      if (searchParams.get('error')) {
        setError('El enlace de recuperacion no es valido o ya expiro. Solicita uno nuevo.')
        setVerifying(false)
        return
      }

      const { data, error: userError } = await supabase.auth.getUser()

      if (userError || !data.user) {
        setError('Abre esta pagina desde el enlace de recuperacion enviado a tu correo.')
      }

      setVerifying(false)
    }

    void prepareRecoverySession()
  }, [searchParams])

  const passwordRules = useMemo(
    () => [
      { label: 'Minimo 8 caracteres', valid: password.length >= 8 },
      { label: 'Coincide con la confirmacion', valid: !!password && password === confirmPassword },
    ],
    [confirmPassword, password]
  )

  const canSubmit = passwordRules.every((rule) => rule.valid) && !submitting && !verifying && !error

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.')
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      })
      const result = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'No se pudo actualizar la contrasena.')
      }

      setSuccess('Contrasena actualizada correctamente. Te enviaremos al login para iniciar sesion de nuevo.')
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        void supabase.auth.signOut().finally(() => router.replace('/login'))
      }, 1600)
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la contrasena.')
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
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
              Nueva clave
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              Define una contrasena nueva para tu cuenta
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              Usa una clave privada y diferente a las anteriores. Despues de guardarla, el sistema pedira iniciar sesion otra vez.
            </p>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
            <p className="text-sm font-semibold text-slate-100">
              El cambio se realiza con la sesion temporal del enlace de recuperacion.
            </p>
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
                <p className="mt-1 text-xl font-semibold text-slate-900">Actualizar contrasena</p>
              </div>
            </div>
            <ThemeToggle className="w-11 px-0 sm:w-auto sm:px-3" />
          </div>

          {verifying ? (
            <div className="rounded-[22px] border border-white/80 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-teal-700" />
                Verificando enlace de recuperacion...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
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
                <label className="label-field">Nueva contrasena</label>
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="input-shell pl-11 pr-12"
                    placeholder="Minimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label-field">Confirmar contrasena</label>
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="input-shell pl-11 pr-12"
                    placeholder="Repetir clave"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showConfirmPassword ? 'Ocultar confirmacion' : 'Mostrar confirmacion'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/80 bg-slate-50/80 px-4 py-3">
                <div className="grid gap-2">
                  {passwordRules.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-2 text-xs">
                      <span className={rule.valid ? 'h-2.5 w-2.5 rounded-full bg-teal-500' : 'h-2.5 w-2.5 rounded-full bg-slate-300'} />
                      <span className={rule.valid ? 'font-semibold text-teal-700' : 'text-slate-500'}>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
                {submitting ? 'Guardando...' : 'Guardar nueva contrasena'}
              </button>
            </form>
          )}

          <Link href="/recuperar-password" className="action-btn-ghost mt-4 justify-center">
            Solicitar otro enlace
          </Link>
        </div>
      </section>
    </div>
  )
}
