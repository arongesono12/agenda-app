'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, Loader2, LockKeyhole, Mail, ShieldPlus, UserCog } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

type PublicDepartamento = {
  id: number
  nombre: string
}

const ROLES = [
  { code: 'responsable', label: 'Responsable' },
  { code: 'supervisor', label: 'Supervisor' },
  { code: 'consulta', label: 'Consulta' },
  { code: 'administrador', label: 'Administrador' },
  { code: 'administradora', label: 'Administradora' },
]

export default function LocalRegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleCode, setRoleCode] = useState('responsable')
  const [departamento, setDepartamento] = useState('')
  const [departamentos, setDepartamentos] = useState<PublicDepartamento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const loadDepartamentos = async () => {
      try {
        const response = await fetch('/api/register')
        const data = (await response.json()) as { ok?: boolean; departamentos?: PublicDepartamento[] }

        if (response.ok && data.ok && data.departamentos?.length) {
          setDepartamentos(data.departamentos)
          setDepartamento((current) => current || data.departamentos?.[0]?.nombre || '')
        }
      } catch {
        setDepartamentos([])
      }
    }

    void loadDepartamentos()
  }, [])

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
          roleCode,
          departamento,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo crear el usuario.')
      }

      setSuccess(`Usuario ${data.user.email} ${data.user.action === 'created' ? 'creado' : 'actualizado'} correctamente con rol ${data.user.role}.`)
      setEmail('')
      setPassword('')
      setRoleCode('responsable')
      setDepartamento(departamentos[0]?.nombre ?? '')
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
                Este modulo solo existe para tu entorno local y requiere una sesion autenticada con rol administrador.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                'Usa Admin API de Supabase de forma segura',
                'Confirma el email automaticamente',
                'Solo administradores autenticados pueden usarlo',
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
              <ThemeToggle className="w-11 flex-shrink-0 px-0 sm:w-auto sm:px-3" />
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
                <label className="label-field">Contrasena</label>
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                    className="input-shell pl-11"
                    placeholder="Minimo 8 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="label-field">Rol del usuario</label>
                <div className="relative">
                  <UserCog size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={roleCode}
                    onChange={(event) => setRoleCode(event.target.value)}
                    className="input-shell pl-11"
                  >
                    {ROLES.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-field">Departamento</label>
                <div className="relative">
                  <Building2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={departamento}
                    onChange={(event) => setDepartamento(event.target.value)}
                    required
                    className="input-shell appearance-none pl-11 pr-10"
                  >
                    <option value="">Seleccionar departamento</option>
                    {departamentos.map((item) => (
                      <option key={item.id} value={item.nombre}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !departamento}
                className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldPlus size={16} />}
                {loading ? 'Creando usuario...' : 'Crear usuario local'}
              </button>
            </form>

            <Link href="/" className="action-btn-ghost mt-4 justify-center">
              <ArrowLeft size={16} />
              Volver a la agenda
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
