'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  CalendarDays,
  Check,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
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
const AVATAR_CROP_SIZE = 512
const AVATAR_CROP_VIEW_SIZE = 280

type CropImageState = {
  src: string
  fileName: string
  naturalWidth: number
  naturalHeight: number
}

type CropOffset = {
  x: number
  y: number
}

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

function getCoveredImageSize(naturalWidth: number, naturalHeight: number, viewSize: number, zoom: number) {
  const baseScale = Math.max(viewSize / naturalWidth, viewSize / naturalHeight)
  return {
    width: naturalWidth * baseScale * zoom,
    height: naturalHeight * baseScale * zoom,
    scale: baseScale * zoom,
  }
}

function clampCropOffset(image: CropImageState, zoom: number, offset: CropOffset): CropOffset {
  const covered = getCoveredImageSize(image.naturalWidth, image.naturalHeight, AVATAR_CROP_VIEW_SIZE, zoom)
  const maxX = Math.max(0, (covered.width - AVATAR_CROP_VIEW_SIZE) / 2)
  const maxY = Math.max(0, (covered.height - AVATAR_CROP_VIEW_SIZE) / 2)

  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

async function createCroppedAvatarFile(image: CropImageState, zoom: number, offset: CropOffset) {
  const sourceImage = new Image()
  sourceImage.src = image.src
  await new Promise<void>((resolve, reject) => {
    sourceImage.onload = () => resolve()
    sourceImage.onerror = () => reject(new Error('No se pudo preparar la imagen seleccionada.'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_CROP_SIZE
  canvas.height = AVATAR_CROP_SIZE

  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo crear el recorte de la imagen.')

  const covered = getCoveredImageSize(image.naturalWidth, image.naturalHeight, AVATAR_CROP_VIEW_SIZE, zoom)
  const left = (AVATAR_CROP_VIEW_SIZE - covered.width) / 2 + offset.x
  const top = (AVATAR_CROP_VIEW_SIZE - covered.height) / 2 + offset.y
  const sourceX = Math.max(0, -left / covered.scale)
  const sourceY = Math.max(0, -top / covered.scale)
  const sourceSize = AVATAR_CROP_VIEW_SIZE / covered.scale

  context.drawImage(
    sourceImage,
    sourceX,
    sourceY,
    Math.min(image.naturalWidth - sourceX, sourceSize),
    Math.min(image.naturalHeight - sourceY, sourceSize),
    0,
    0,
    AVATAR_CROP_SIZE,
    AVATAR_CROP_SIZE
  )

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('No se pudo generar la imagen recortada.')

  const safeName = image.fileName.replace(/\.[^.]+$/, '') || 'avatar'
  return new File([blob], `${safeName}-recortada.jpg`, { type: 'image/jpeg' })
}

export default function PerfilPage() {
  const router = useRouter()
  const { refreshProfile } = useUserSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schemaWarning, setSchemaWarning] = useState('')
  const [profile, setProfile] = useState<PerfilUsuario | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [cropImage, setCropImage] = useState<CropImageState | null>(null)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffset, setCropOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const [cropDragStart, setCropDragStart] = useState<{ pointerId: number; x: number; y: number; offset: CropOffset } | null>(null)

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
    setCropImage(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const tipoUsuario = useMemo(
    () => normalizarTipoUsuario(profile?.tipo_usuario),
    [profile?.tipo_usuario]
  )

  const openEditModal = () => {
    setForm({
      nombre: profile?.nombre_completo ?? '',
      password: '',
      confirmPassword: '',
    })
    setAvatarFile(null)
    setAvatarPreview(profile?.avatar_url ?? null)
    setRemoveAvatar(false)
    setCropImage(null)
    setError('')
    setSuccess('')
    setEditOpen(true)
  }

  useEffect(() => {
    if (!editOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editOpen])

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

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const image = new Image()
        image.onload = () => {
          setCropImage({
            src: reader.result as string,
            fileName: file.name,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
          })
          setCropZoom(1)
          setCropOffset({ x: 0, y: 0 })
        }
        image.onerror = () => setError('No se pudo leer la imagen seleccionada.')
        image.src = reader.result
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const clearAvatar = () => {
    setAvatarFile(null)
    setRemoveAvatar(true)
    setAvatarPreview(null)
    setCropImage(null)
  }

  const closeCropModal = () => {
    setCropImage(null)
    setCropDragStart(null)
  }

  const handleCropZoom = (value: number) => {
    if (!cropImage) return
    const nextZoom = Math.min(3, Math.max(1, value))
    setCropZoom(nextZoom)
    setCropOffset((current) => clampCropOffset(cropImage, nextZoom, current))
  }

  const applyAvatarCrop = async () => {
    if (!cropImage) return

    try {
      const safeOffset = clampCropOffset(cropImage, cropZoom, cropOffset)
      const croppedFile = await createCroppedAvatarFile(cropImage, cropZoom, safeOffset)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatarPreview(reader.result)
        }
      }
      reader.readAsDataURL(croppedFile)
      setAvatarFile(croppedFile)
      setRemoveAvatar(false)
      closeCropModal()
    } catch (cropError: unknown) {
      setError(cropError instanceof Error ? cropError.message : 'No se pudo recortar la imagen.')
    }
  }

  const cropCovered = cropImage
    ? getCoveredImageSize(cropImage.naturalWidth, cropImage.naturalHeight, AVATAR_CROP_VIEW_SIZE, cropZoom)
    : null
  const cropImageStyle = cropImage && cropCovered
    ? {
        width: `${cropCovered.width}px`,
        height: `${cropCovered.height}px`,
        left: `${(AVATAR_CROP_VIEW_SIZE - cropCovered.width) / 2 + cropOffset.x}px`,
        top: `${(AVATAR_CROP_VIEW_SIZE - cropCovered.height) / 2 + cropOffset.y}px`,
      }
    : undefined

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
      setTimeout(() => setEditOpen(false), 1200)
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
          <button onClick={() => void loadProfile()} className="action-btn icon-action-btn h-12 w-12 rounded-2xl" aria-label="Recargar perfil">
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,480px)]">
        <section className="surface-panel-dark relative overflow-hidden text-white">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.2),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.12),transparent_55%)]" />

          <div className="relative h-24 bg-gradient-to-br from-teal-800/25 via-slate-800/10 to-transparent" />

          <div className="relative px-6 pb-7">
            <div className="-mt-14 flex items-start justify-between gap-3">
              <div className="rounded-full bg-gradient-to-br from-teal-400/20 to-slate-900/40 p-1 ring-2 ring-teal-500/20">
                <UserAvatar
                  name={profile?.nombre_completo}
                  avatarUrl={avatarPreview}
                  size="xl"
                  className="h-24 w-24 rounded-full ring-4 ring-slate-900"
                />
              </div>
              <span className="mt-16 inline-flex items-center gap-1.5 rounded-full border border-teal-200/20 bg-teal-400/10 px-3 py-1.5 text-[11px] font-semibold text-teal-100">
                <BadgeCheck size={13} />
                {tipoUsuario?.nombre ?? 'Responsable'}
              </span>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Identidad activa</p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-50">
                {profile?.nombre_completo || 'Sin nombre configurado'}
              </h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                <Mail size={13} className="flex-shrink-0 text-teal-400/70" />
                {profile?.email}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-teal-300" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Rol</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-100">{tipoUsuario?.nombre ?? 'Responsable'}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">{tipoUsuario?.descripcion ?? 'Perfil operativo con acceso autenticado.'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2 text-teal-300">
                    <CalendarDays size={13} />
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Alta</p>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-100">{formatDateTime(profile?.created_at)}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={13} className="text-teal-300" />
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Cambio</p>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold leading-5 text-slate-100">{formatDateTime(profile?.updated_at)}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={openEditModal}
              className="action-btn-primary mt-6 w-full justify-center"
            >
              <Pencil size={15} />
              Editar perfil
            </button>
          </div>
        </section>

      </div>

      {editOpen && (
        <div
          className="agenda-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false) }}
        >
          <div className="agenda-modal-shell w-full max-w-xl">
            <div className="flex items-center justify-between border-b border-white/70 px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Configuracion personal</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">Editar datos de acceso</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="agenda-modal-close"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <p className="mb-5 text-sm leading-6 text-slate-500">
                Los cambios se guardan en tu perfil, en la autenticacion de Supabase y en el avatar visible del sidebar.
              </p>

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
                      className="h-20 w-20 rounded-full"
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
                        <button type="button" onClick={clearAvatar} className="action-btn-ghost justify-center">
                          <Trash2 size={16} />
                          Quitar foto
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">JPG, PNG o WEBP · Max 5 MB</p>
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
                      title="Correo asociado a la cuenta"
                      placeholder="correo@segesa.gq"
                      className="input-shell cursor-not-allowed pl-11 opacity-60"
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

                <div className="rounded-[22px] border border-white/80 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500">
                  Si dejas la contrasena vacia, solo se actualizara el nombre y la foto.
                </div>

                <div className="flex gap-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="action-btn-ghost flex-1 justify-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="action-btn-primary flex-1 justify-center disabled:translate-y-0 disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {cropImage && cropCovered && cropImageStyle && (
        <div
          className="agenda-modal-overlay z-[220]"
          onClick={(e) => { if (e.target === e.currentTarget) closeCropModal() }}
        >
          <div className="agenda-modal-shell w-full max-w-md">
            <div className="flex items-center justify-between border-b border-white/70 px-6 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Foto de perfil</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">Recortar imagen</p>
              </div>
              <button
                type="button"
                onClick={closeCropModal}
                className="agenda-modal-close"
                aria-label="Cerrar recorte"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="flex justify-center">
                <div
                  className="relative overflow-hidden rounded-full border border-white/80 bg-slate-950 shadow-[0_20px_55px_rgba(15,23,42,0.22)]"
                  style={{
                    width: AVATAR_CROP_VIEW_SIZE,
                    height: AVATAR_CROP_VIEW_SIZE,
                    touchAction: 'none',
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId)
                    setCropDragStart({
                      pointerId: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                      offset: cropOffset,
                    })
                  }}
                  onPointerMove={(event) => {
                    if (!cropDragStart || cropDragStart.pointerId !== event.pointerId) return
                    setCropOffset(clampCropOffset(cropImage, cropZoom, {
                      x: cropDragStart.offset.x + event.clientX - cropDragStart.x,
                      y: cropDragStart.offset.y + event.clientY - cropDragStart.y,
                    }))
                  }}
                  onPointerUp={(event) => {
                    if (cropDragStart?.pointerId === event.pointerId) setCropDragStart(null)
                  }}
                  onPointerCancel={() => setCropDragStart(null)}
                >
                  <img
                    src={cropImage.src}
                    alt="Imagen seleccionada para recortar"
                    className="absolute max-w-none select-none"
                    draggable={false}
                    style={cropImageStyle}
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent_62%,rgba(15,23,42,0.48)_63%)]" />
                </div>
              </div>

              <div className="mt-5">
                <label className="label-field">Zoom</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropZoom}
                  onChange={(event) => handleCropZoom(Number(event.target.value))}
                  className="w-full accent-teal-600"
                  aria-label="Ajustar zoom del recorte"
                />
              </div>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                Arrastra la imagen para encuadrarla dentro del circulo.
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeCropModal}
                  className="action-btn-ghost flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void applyAvatarCrop()}
                  className="action-btn-primary flex-1 justify-center"
                >
                  <Check size={16} />
                  Usar recorte
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
