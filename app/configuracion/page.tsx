'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Monitor, RefreshCw, Save, SlidersHorizontal } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import type { PerfilUsuario, PreferenciasUsuario } from '@/lib/types'
import { useTheme } from '@/components/ThemeProvider'
import {
  DEFAULT_USER_PREFERENCES,
  normalizarPreferenciasUsuario,
} from '@/lib/user-preferences'

type ConfigQueryRow = Pick<PerfilUsuario, 'id' | 'email' | 'nombre_completo' | 'preferencias'>

export default function ConfiguracionPage() {
  const { theme, setTheme, mounted } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schemaWarning, setSchemaWarning] = useState('')
  const [profile, setProfile] = useState<ConfigQueryRow | null>(null)
  const [preferences, setPreferences] = useState(DEFAULT_USER_PREFERENCES)

  const loadSettings = useCallback(async () => {
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

    const { data, error: profileError } = await supabase
      .from('perfiles_usuario')
      .select('id, email, nombre_completo, preferencias')
      .eq('id', user.id)
      .maybeSingle()

    const profileRow = data as ConfigQueryRow | null

    if (profileError && profileError.code !== 'PGRST116') {
      setSchemaWarning('No se pudo leer las preferencias guardadas. Ejecuta supabase/migration_user_preferences.sql en tu proyecto.')
    } else {
      setSchemaWarning('')
    }

    const nextPreferences = normalizarPreferenciasUsuario({
      ...profileRow?.preferencias,
      theme: mounted ? theme : profileRow?.preferencias?.theme,
    })

    setProfile({
      id: user.id,
      email: profileRow?.email ?? user.email ?? '',
      nombre_completo:
        profileRow?.nombre_completo ??
        (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null),
      preferencias: nextPreferences,
    })
    setPreferences(nextPreferences)
    setLoading(false)
  }, [mounted, theme])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const updatePreference = <K extends keyof typeof DEFAULT_USER_PREFERENCES>(
    key: K,
    value: (typeof DEFAULT_USER_PREFERENCES)[K]
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!profile) {
      setError('No se encontro un usuario activo para guardar las preferencias.')
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

      const normalizedPreferences: PreferenciasUsuario = normalizarPreferenciasUsuario(preferences)

      const { error: saveError } = await supabase.from('perfiles_usuario').upsert(
        {
          id: user.id,
          email: user.email ?? profile.email,
          nombre_completo:
            profile.nombre_completo ??
            (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null),
          preferencias: normalizedPreferences,
        },
        { onConflict: 'id' }
      )

      if (saveError) {
        throw saveError
      }

      setTheme(normalizedPreferences.theme ?? 'light')
      setSuccess('Preferencias guardadas correctamente.')
      await loadSettings()
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudieron guardar las preferencias.')
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
        title="Configuracion"
        subtitle="Administra las preferencias personales que afectan la experiencia de la agenda para tu usuario."
        icon={<SlidersHorizontal size={22} />}
        actions={
          <button onClick={() => void loadSettings()} className="action-btn h-12 w-12 rounded-2xl p-0" aria-label="Recargar configuracion">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {schemaWarning && (
        <div className="surface-panel border border-amber-200 bg-amber-50/90 p-5 text-amber-900">
          <p className="text-sm font-semibold">Configuracion extendida pendiente</p>
          <p className="mt-2 text-sm leading-6">{schemaWarning}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.2fr]">
        <section className="surface-panel-dark overflow-hidden p-6 text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-100/85">
            <Monitor size={14} />
            Preferencias activas
          </span>

          <div className="mt-6 space-y-4">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Tema</p>
              <p className="mt-2 text-lg font-semibold text-slate-100">
                {preferences.theme === 'dark' ? 'Oscuro' : 'Claro'}
              </p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Agenda diaria</p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {preferences.mostrar_kpis_agenda ? 'KPIs visibles en la cabecera' : 'KPIs ocultos para una vista mas limpia'}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                {preferences.abrir_filtros_agenda ? 'Filtros abiertos por defecto' : 'Filtros cerrados al entrar'}
              </p>
            </div>
          </div>
        </section>

        <section className="surface-panel-strong p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Preferencias personales</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Gestion de la agenda</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Estas opciones se guardan para tu usuario y afectan la forma en que ves y usas la agenda.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
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
              <label className="label-field">Tema visual</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updatePreference('theme', 'light')}
                  className={preferences.theme === 'light' ? 'action-btn border-teal-200 bg-teal-50/90 text-teal-700 justify-center' : 'action-btn justify-center'}
                >
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => updatePreference('theme', 'dark')}
                  className={preferences.theme === 'dark' ? 'action-btn border-teal-200 bg-teal-50/90 text-teal-700 justify-center' : 'action-btn justify-center'}
                >
                  Oscuro
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/80 bg-slate-50/80 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Mostrar indicadores en la agenda</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Controla si la cabecera de KPIs aparece al entrar en la agenda diaria.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePreference('mostrar_kpis_agenda', !preferences.mostrar_kpis_agenda)}
                  className={preferences.mostrar_kpis_agenda ? 'action-btn border-teal-200 bg-teal-50/90 text-teal-700 min-w-20 justify-center' : 'action-btn min-w-20 justify-center'}
                >
                  {preferences.mostrar_kpis_agenda ? 'Activo' : 'Oculto'}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/80 bg-slate-50/80 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Abrir filtros automaticamente</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Si lo activas, la agenda mostrara el panel de filtros desplegado al cargar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updatePreference('abrir_filtros_agenda', !preferences.abrir_filtros_agenda)}
                  className={preferences.abrir_filtros_agenda ? 'action-btn border-teal-200 bg-teal-50/90 text-teal-700 min-w-20 justify-center' : 'action-btn min-w-20 justify-center'}
                >
                  {preferences.abrir_filtros_agenda ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="action-btn-primary w-full justify-center disabled:translate-y-0 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Guardando preferencias...' : 'Guardar preferencias'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
