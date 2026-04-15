'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PerfilUsuario, TipoUsuario } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import UserAvatar from '@/components/ui/UserAvatar'
import { useUserSession } from '@/components/UserSessionProvider'

type PerfilQueryRow = Omit<PerfilUsuario, 'tipo_usuario'> & {
  tipo_usuario?: TipoUsuario | TipoUsuario[] | null
}

const EMPTY_FORM = {
  nombre: '',
  password: '',
  confirmPassword: '',
}

const MAX_AVATAR_SIZE = 5 * 1024 * 1024

function normalizarTipoUsuario(value?: TipoUsuario | TipoUsuario[] | null) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sin registro'

  try {
    return new Date(value).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function getAvatarPath(userId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-').toLowerCase()
  return `${userId}/${Date.now()}-${safeName}`
}

export default function PerfilPage() {
  const router = useRouter()
  const { refreshProfile } = useUserSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schemaWarning, setSchemaWarning] = useState('')
  const [profile, setProfile] = useState<PerfilUsuario | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setProfile(null)
      setError(userError?.message ?? 'No se pudo cargar la sesion actual.')
      setLoading(false)
      return
    }

    const fallbackName =
      typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
    const fallbackAvatar =
      typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url.trim() : ''

    const { data, error: profileError } = await supabase
      .from('perfiles_usuario')
      .select('id, email, nombre_completo, avatar_url, tipo_usuario_id, created_at, updated_at, tipo_usuario:tipos_usuario(id, codigo, nombre, descripcion, created_at)')
      .eq('id', user.id)
      .maybeSingle()

    const profileRow = data as PerfilQueryRow | null

    if (profileError && profileError.code !== 'PGRST116') {
      setSchemaWarning('No se pudo leer el perfil extendido. Ejecuta los scripts supabase/migration_user_profiles.sql y supabase/migration_user_avatars.sql en tu proyecto.')
    } else {
      setSchemaWarning('')
    }

    const mergedProfile: PerfilUsuario = {
      id: user.id,
      email: profileRow?.email ?? user.email ?? '',
      nombre_completo: profileRow?.nombre_completo ?? fallbackName,
      avatar_url: profileRow?.avatar_url ?? fallbackAvatar,
      tipo_usuario_id: profileRow?.tipo_usuario_id ?? null,
      created_at: profileRow?.created_at,
      updated_at: profileRow?.updated_at ?? user.updated_at,
      tipo_usuario: normalizarTipoUsuario(profileRow?.tipo_usuario),
    }

    setProfile(mergedProfile)
    setForm({
      nombre: mergedProfile.nombre_completo ?? '',
      password: '',
      confirmPassword: '',
    })
    setAvatarFile(null)
    setAvatarPreview(mergedProfile.avatar_url ?? null)
    setRemoveAvatar(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const tipoUsuario = useMemo(
    () => normalizarTipoUsuario(profile?.tipo_usuario),
    [profile?.tipo_usuario]
  )

  const handleChange = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleAvatarSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen valida para el avatar.')
      return
    }

    if (file.size > MAX_AVATAR_SIZE) {
      setError('La imagen del avatar no puede superar 5 MB.')
      return
    }

    setError('')
    setAvatarFile(file)
    setRemoveAvatar(false)

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarPreview(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const clearAvatar = () => {
    setAvatarFile(null)
    setRemoveAvatar(true)
    setAvatarPreview(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!profile) {
      setError('No hay un usuario activo para actualizar.')
      return
    }

    const nombre = form.nombre.trim()

    if (!nombre) {
      setError('El nombre del usuario es obligatorio.')
      return
    }

    if (form.password && form.password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres.')
      return
    }

    if (form.password && form.password !== form.confirmPassword) {
      setError('La confirmacion de la contrasena no coincide.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(userError?.message ?? 'No se pudo identificar al usuario autenticado.')
      }

      let avatarUrl = removeAvatar ? null : profile.avatar_url ?? null

      if (avatarFile) {
        const avatarPath = getAvatarPath(user.id, avatarFile)
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(avatarPath, avatarFile, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          throw new Error(`No se pudo subir el avatar. ${uploadError.message}`)
        }

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
        avatarUrl = publicData.publicUrl
      }

      const currentName =
        typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
      const currentAvatar =
        typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url.trim() : ''

      const authPayload: { data?: Record<string, unknown>; password?: string } = {}

      if (nombre !== currentName || (avatarUrl ?? '') !== currentAvatar) {
        authPayload.data = {
          ...user.user_metadata,
          full_name: nombre,
          avatar_url: avatarUrl,
        }
      }

      if (form.password) {
        authPayload.password = form.password
      }

      if (authPayload.data || authPayload.password) {
        const { error: authUpdateError } = await supabase.auth.updateUser(authPayload)

        if (authUpdateError) {
          throw authUpdateError
        }
      }

      const { error: profileUpsertError } = await supabase.from('perfiles_usuario').upsert(
        {
          id: user.id,
          email: user.email ?? profile.email,
          nombre_completo: nombre,
          avatar_url: avatarUrl,
        },
        { onConflict: 'id' }
      )

      if (profileUpsertError) {
        throw profileUpsertError
      }

      setSuccess(
        form.password
          ? 'Perfil actualizado correctamente, incluyendo la foto y la contrasena.'
          : 'Perfil actualizado correctamente.'
      )

      setForm((current) => ({
        ...current,
        password: '',
        confirmPassword: '',
      }))

      await refreshProfile()
      await loadProfile()
      router.refresh()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo actualizar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Perfil de usuario"
        subtitle="Actualiza tu nombre visible, tu foto y tu contrasena para mantener tu cuenta al dia."
        icon={<UserRound size={22} />}
        actions={
          <button onClick={() => void loadProfile()} className="action-btn h-12 w-12 rounded-2xl p-0" aria-label="Recargar perfil">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {schemaWarning && (
        <div className="surface-panel border border-amber-200 bg-amber-50/90 p-5 text-amber-900">
          <p className="text-sm font-semibold">Perfil extendido pendiente</p>
          <p className="mt-2 text-sm leading-6">{schemaWarning}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <section className="surface-panel-dark overflow-hidden p-6 text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
            <ShieldCheck size={14} />
            Identidad activa
          </span>

          <div className="mt-6 space-y-4">
            <div className="flex flex-col items-center rounded-[30px] border border-white/10 bg-white/[0.05] p-6 text-center">
              <UserAvatar
                name={profile?.nombre_completo}
                avatarUrl={avatarPreview}
                size="xl"
                className="h-28 w-28 rounded-full"
              />
              <p className="mt-4 text-xl font-semibold text-slate-100">
                {profile?.nombre_completo || 'Sin nombre configurado'}
              </p>
              <span className="mt-3 inline-flex items-center rounded-full border border-teal-200/20 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-100">
                {tipoUsuario?.nombre ?? 'Responsable'}
              </span>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-teal-100" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Correo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{profile?.email}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Tipo de usuario</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="badge border-teal-200/20 bg-teal-400/10 text-teal-100">
                  <BadgeCheck size={14} />
                  {tipoUsuario?.nombre ?? 'Responsable'}
                </span>
                <span className="text-xs text-slate-300">{tipoUsuario?.descripcion ?? 'Perfil operativo con acceso autenticado.'}</span>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Ultima actualizacion</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">{formatDateTime(profile?.updated_at)}</p>
            </div>
          </div>
        </section>

        <section className="surface-panel-strong p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Configuracion personal</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Editar datos de acceso</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Los cambios se guardan en tu perfil, en la autenticacion de Supabase y en el avatar visible del sidebar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            )}

            <div className="rounded-[28px] border border-white/80 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <UserAvatar
                  name={form.nombre || profile?.nombre_completo}
                  avatarUrl={avatarPreview}
                  size="lg"
                  className="h-24 w-24 rounded-full"
                />

                <div className="flex-1">
                  <label className="label-field">Foto del perfil</label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="action-btn cursor-pointer justify-center">
                      <Upload size={16} />
                      Subir foto
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAvatarSelection}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={clearAvatar}
                      className="action-btn-ghost justify-center"
                    >
                      <Trash2 size={16} />
                      Quitar foto
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Sube una imagen JPG, PNG o WEBP de hasta 5 MB.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="label-field">Nombre del usuario</label>
              <div className="relative">
                <UserRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(event) => handleChange('nombre', event.target.value)}
                  className="input-shell pl-11"
                  placeholder="Nombre completo"
                />
              </div>
            </div>

            <div>
              <label className="label-field">Correo asociado</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={profile?.email ?? ''}
                  readOnly
                  className="input-shell cursor-not-allowed pl-11 opacity-80"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">Nueva contrasena</label>
                <div className="relative">
                  <KeyRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => handleChange('password', event.target.value)}
                    minLength={8}
                    className="input-shell pl-11"
                    placeholder="Minimo 8 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="label-field">Confirmar contrasena</label>
                <div className="relative">
                  <KeyRound size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => handleChange('confirmPassword', event.target.value)}
                    minLength={8}
                    className="input-shell pl-11"
                    placeholder="Repite la contrasena"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">
              Si dejas la contrasena vacia, solo se actualizara el nombre y la foto del usuario.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Guardando cambios...' : 'Guardar cambios'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
