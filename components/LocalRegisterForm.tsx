'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, Mail, ShieldPlus } from 'lucide-react'

export default function LocalRegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/local/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo crear el usuario.')
      }

      setSuccess(`Usuario ${data.user.email} ${data.user.action === 'created' ? 'creado' : 'actualizado'} correctamente.`)
      setEmail('')
      setPassword('')
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo crear el usuario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[1fr_0.95fr]">
        <section className="surface-panel-dark relative overflow-hidden p-6 text-white sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_34%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
                Solo desarrollo
              </span>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                Registro local de usuarios
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Este módulo solo existe para tu entorno local. En producción no se renderiza y la API devuelve acceso denegado.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                'Usa Admin API de Supabase de forma segura',
                'Confirma el email automáticamente',
                'No aparece en producción ni en el menú principal',
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
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">Provisioning local</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">Crear usuario manual</p>
              </div>
              <ShieldPlus size={22} className="text-teal-700" />
            </div>

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
                <label className="label-field">Correo</label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                    type="text"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                    className="input-shell pl-11"
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldPlus size={16} />}
                {loading ? 'Creando usuario...' : 'Crear usuario local'}
              </button>
            </form>

            <Link href="/login" className="action-btn-ghost mt-4 justify-center">
              <ArrowLeft size={16} />
              Volver al login
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
