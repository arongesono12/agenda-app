'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { PUBLIC_REGISTRATION_ROLES, REGISTRATION_DEPARTAMENTOS } from '@/lib/registration-options'
import { supabase } from '@/lib/supabase'

type PublicRole = {
  codigo: string
  nombre: string
  descripcion?: string | null
}

type PublicDepartamento = {
  id: number
  nombre: string
}

type PublicOrganismo = {
  id: string
  nombre: string
  slug?: string | null
}

export default function RegisterForm({
  nextPath = '/organismos/nuevo',
  invitacionToken,
  initialFullName,
  initialEmail,
  initialOrganismoName,
}: {
  nextPath?: string
  invitacionToken?: string
  initialFullName?: string
  initialEmail?: string
  initialOrganismoName?: string
}) {
  const router = useRouter()
  const [roles, setRoles] = useState<PublicRole[]>(PUBLIC_REGISTRATION_ROLES)
  const [departamentos, setDepartamentos] = useState<PublicDepartamento[]>(REGISTRATION_DEPARTAMENTOS)
  const [organismos, setOrganismos] = useState<PublicOrganismo[]>([])
  const [fullName, setFullName] = useState(initialFullName?.trim() ?? '')
  const [email, setEmail] = useState(initialEmail?.trim() ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [roleCode, setRoleCode] = useState('responsable')
  const roleCodeRef = useRef(roleCode)
  const [organismoId, setOrganismoId] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const normalizedEmail = email.trim().toLowerCase()
  const isSegesaEmail = normalizedEmail.endsWith('@segesa.gq')
  const segesaOrganismo = useMemo(
    () =>
      organismos.find(
        (organismo) =>
          organismo.id === '00000000-0000-0000-0000-000000000001' ||
          organismo.nombre.trim().toLowerCase() === 'segesa'
      ),
    [organismos]
  )
  const selectableRoles = useMemo(() => {
    return roles
  }, [roles])
  const selectedRole = useMemo(
    () => selectableRoles.find(role => role.codigo === roleCode),
    [selectableRoles, roleCode]
  )

  useEffect(() => {
    roleCodeRef.current = roleCode
  }, [roleCode])

  useEffect(() => {
    if (!selectableRoles.some((role) => role.codigo === roleCode)) {
      setRoleCode(selectableRoles[0]?.codigo ?? 'responsable')
    }
  }, [roleCode, selectableRoles])

  useEffect(() => {
    const loadRoles = async () => {
      setLoadingRoles(true)

      try {
        const response = await fetch('/api/register')
        const data = (await response.json()) as {
          ok?: boolean
          roles?: PublicRole[]
          departamentos?: PublicDepartamento[]
          organismos?: PublicOrganismo[]
        }

        const nextRoles = response.ok && data.ok && data.roles?.length ? data.roles : PUBLIC_REGISTRATION_ROLES
        const nextDepartamentos =
          response.ok && data.ok && data.departamentos?.length ? data.departamentos : REGISTRATION_DEPARTAMENTOS

        setRoles(nextRoles)
        setDepartamentos(nextDepartamentos)
        setOrganismos(response.ok && data.ok && data.organismos?.length ? data.organismos : [])
        if (!nextRoles.some((role) => role.codigo === roleCodeRef.current)) {
          setRoleCode(nextRoles[0].codigo)
        }
        setDepartamento((current) => current || nextDepartamentos[0]?.nombre || '')
      } catch {
        setRoles(PUBLIC_REGISTRATION_ROLES)
        setDepartamentos(REGISTRATION_DEPARTAMENTOS)
        setOrganismos([])
        setDepartamento((current) => current || REGISTRATION_DEPARTAMENTOS[0]?.nombre || '')
      } finally {
        setLoadingRoles(false)
      }
    }

    void loadRoles()
  }, [])

  useEffect(() => {
    if (isSegesaEmail && segesaOrganismo) {
      setOrganismoId(segesaOrganismo.id)
    }
  }, [isSegesaEmail, segesaOrganismo])

  useEffect(() => {
    const target = initialOrganismoName?.trim().toLowerCase()
    if (!target || organismoId) return

    const match = organismos.find((organismo) =>
      organismo.nombre.trim().toLowerCase() === target ||
      organismo.slug?.trim().toLowerCase() === target
    )
    if (match) setOrganismoId(match.id)
  }, [initialOrganismoName, organismoId, organismos])

  const passwordRules = [
    { label: 'Minimo 8 caracteres', valid: password.length >= 8 },
    { label: 'Coincide con la confirmacion', valid: !!password && password === confirmPassword },
  ]

  const canSubmit =
    fullName.trim().length > 2 &&
    email.trim().length > 4 &&
    departamento.trim().length > 0 &&
    passwordRules.every((rule) => rule.valid) &&
    accepted &&
    !loading

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden.')
      setLoading(false)
      return
    }

    if (!accepted) {
      setError('Debes confirmar que los datos son correctos.')
      setLoading(false)
      return
    }

    try {
      const passwordForSignIn = password
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          roleCode,
          departamento,
          organismoId: isSegesaEmail ? segesaOrganismo?.id : organismoId || undefined,
          invitacionToken,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo registrar el usuario.')
      }

      const destination =
        typeof data.redirect === 'string'
          ? data.redirect
          : nextPath.startsWith('/organismos/nuevo')
            ? nextPath
            : '/organismos/nuevo'

      setSuccess(
        destination === '/organismos/nuevo'
          ? `Usuario ${data.user.email} creado correctamente. Continuando con la creacion de tu organo...`
          : `Usuario ${data.user.email} creado correctamente. Entrando al organo seleccionado...`
      )
      setFullName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setOrganismoId('')
      setDepartamento(departamentos[0]?.nombre ?? '')
      setAccepted(false)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.user.email,
        password: passwordForSignIn,
      })

      if (signInError) {
        setTimeout(() => router.push(`/login?next=${encodeURIComponent(destination)}`), 1000)
        return
      }

      setTimeout(() => {
        router.push(destination)
        router.refresh()
      }, 700)
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar el usuario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="grid w-full max-w-md grid-cols-1 gap-6 lg:max-w-5xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="surface-panel-dark relative hidden overflow-hidden p-6 text-white sm:p-8 lg:block lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.22),transparent_34%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
                <ShieldCheck size={14} />
                Alta protegida
              </span>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                Registro de usuarios para la agenda operativa
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                La cuenta queda vinculada a un perfil interno, un departamento y un rol autorizado del sistema.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                { icon: <BadgeCheck size={18} />, title: 'Rol validado', text: 'Se muestran los roles operativos disponibles para la agenda.' },
                { icon: <LockKeyhole size={18} />, title: 'Credenciales seguras', text: 'La contrasena se valida antes de crear el acceso.' },
                { icon: <UsersRound size={18} />, title: 'Perfil operativo', text: 'El usuario queda listo para recibir tareas y avisos.' },
              ].map((item) => (
                <div key={item.title} className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-teal-100">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-panel-strong overflow-hidden p-5 sm:p-6 lg:p-8">
          <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">Registro</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">Crear cuenta</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Completa los datos para crear un acceso con trazabilidad dentro del sistema.
                </p>
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
                <label className="label-field">Nombre completo</label>
                <div className="relative">
                  <UserRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="input-shell pl-11"
                    placeholder="Nombre y apellidos"
                  />
                </div>
              </div>

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
                <label htmlFor="organismo-select" className="label-field">Organo</label>
                <div className="relative">
                  <Building2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    id="organismo-select"
                    value={isSegesaEmail ? segesaOrganismo?.id ?? organismoId : organismoId}
                    onChange={(event) => setOrganismoId(event.target.value)}
                    disabled={loadingRoles || isSegesaEmail}
                    className="input-shell appearance-none pl-11 pr-10"
                  >
                    {!isSegesaEmail && <option value="">Crear un organo nuevo despues del registro</option>}
                    {isSegesaEmail && !segesaOrganismo && <option value="">Organo Segesa pendiente de configurar</option>}
                    {organismos.map((organismo) => (
                      <option key={organismo.id} value={organismo.id}>
                        {organismo.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {isSegesaEmail
                    ? 'Los correos de Segesa se vinculan directamente al organo Segesa.'
                    : 'Puedes unirte a un organo existente o crear uno nuevo despues de registrar la cuenta.'}
                </p>
              </div>

              <div>
                <label htmlFor="role-select" className="label-field">Rol solicitado</label>
                <div className="relative">
                  <UsersRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    id="role-select"
                    value={roleCode}
                    onChange={(event) => setRoleCode(event.target.value)}
                    disabled={loadingRoles}
                    className="input-shell appearance-none pl-11 pr-10"
                  >
                    {selectableRoles.map((role) => (
                      <option key={role.codigo} value={role.codigo}>
                        {role.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                {selectedRole?.descripcion && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">{selectedRole.descripcion}</p>
                )}
              </div>

              <div>
                <label className="label-field" htmlFor="departamento-select">Departamento</label>
                <div className="relative">
                  <Building2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    id="departamento-select"
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field">Contrasena</label>
                  <div className="relative">
                    <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={8}
                      required
                      className="input-shell pl-11 pr-12"
                      placeholder="Minimo 8"
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
                  <label className="label-field">Confirmar</label>
                  <div className="relative">
                    <LockKeyhole size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      minLength={8}
                      required
                      className="input-shell pl-11 pr-12"
                      placeholder="Repetir clave"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showConfirmPassword ? 'Ocultar confirmacion de contrasena' : 'Mostrar confirmacion de contrasena'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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

              <label className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-white/80 bg-white/70 px-4 py-3">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-600"
                />
                <span className="text-xs leading-5 text-slate-600">
                  Confirmo que los datos son correctos y entiendo que el acceso queda sujeto a las politicas internas del sistema.
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {loading ? 'Creando cuenta...' : 'Crear cuenta segura'}
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
