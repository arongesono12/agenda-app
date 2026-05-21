'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PerfilUsuario, TipoUsuario, Organismo, OrganismoSuscripcion, RolCodigo } from '@/lib/types'
import { normalizarPreferenciasUsuario } from '@/lib/user-preferences'
import { hasAnyRole, ADMIN_ROLE_CODES } from '@/lib/access-control'
import { getRoleCapabilities, getRoleCapabilitiesForCode, type RoleCapabilitySet } from '@/lib/role-capabilities'
import { getSuscripcionSegesaExenta, ORGANISMO_COOKIE, SEGESA_ORGANISMO_ID } from '@/lib/organismo-access'

type SessionProfileRow = Omit<PerfilUsuario, 'tipo_usuario'> & {
  tipo_usuario?: TipoUsuario | TipoUsuario[] | null
}

interface UserSessionContextValue {
  user: User | null
  profile: PerfilUsuario | null
  loading: boolean
  refreshProfile: () => Promise<void>
  isAdmin: boolean
  canEditAgenda: boolean
  capabilities: RoleCapabilitySet
  // Organismo activo
  organismoActivo: Organismo | null
  rolEnOrganismo: RolCodigo | null
  suscripcion: OrganismoSuscripcion | null
  misOrganismos: Array<{ organismo_id: string; rol_codigo: RolCodigo; organismo: Organismo | null }>
  cambiarOrganismo: (organismoId: string) => Promise<void>
  refreshOrganismo: () => Promise<void>
}

const UserSessionContext = createContext<UserSessionContextValue | null>(null)

function normalizarTipoUsuario(value?: TipoUsuario | TipoUsuario[] | null) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [organismoActivo, setOrganismoActivo] = useState<Organismo | null>(null)
  const [rolEnOrganismo, setRolEnOrganismo] = useState<RolCodigo | null>(null)
  const [suscripcion, setSuscripcion] = useState<OrganismoSuscripcion | null>(null)
  const [misOrganismos, setMisOrganismos] = useState<Array<{ organismo_id: string; rol_codigo: RolCodigo; organismo: Organismo | null }>>([])
  const refreshInProgress = useRef(false)

  const loadOrganismoData = useCallback(async (userId: string) => {
    try {
      const { data: miembros } = await supabase
        .from('organismo_miembros')
        .select('organismo_id, rol_codigo, organismo:organismos(id, nombre, slug, tipo, logo_url, activo)')
        .eq('usuario_id', userId)
        .eq('activo', true)

      if (!miembros?.length) {
        setMisOrganismos([])
        setOrganismoActivo(null)
        setRolEnOrganismo(null)
        setSuscripcion(null)
        return
      }

      const organismosList = miembros.map((m) => ({
        organismo_id: m.organismo_id as string,
        rol_codigo: m.rol_codigo as RolCodigo,
        organismo: (Array.isArray(m.organismo) ? m.organismo[0] : m.organismo) as Organismo | null,
      }))
      setMisOrganismos(organismosList)

      // Determinar organismo activo desde cookie
      const cookieId = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${ORGANISMO_COOKIE}=`))
        ?.split('=')[1]

      const activeOrgData =
        (cookieId && organismosList.find((o) => o.organismo_id === cookieId)) ??
        organismosList.find((o) => o.organismo_id === SEGESA_ORGANISMO_ID) ??
        (organismosList.length === 1 ? organismosList[0] : null)

      if (activeOrgData) {
        setOrganismoActivo(activeOrgData.organismo)
        setRolEnOrganismo(activeOrgData.rol_codigo)

        if (activeOrgData.organismo_id === SEGESA_ORGANISMO_ID) {
          setSuscripcion(getSuscripcionSegesaExenta())
          return
        }

        // Cargar suscripción
        const { data: sub } = await supabase
          .from('organismo_suscripciones')
          .select('*')
          .eq('organismo_id', activeOrgData.organismo_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        setSuscripcion((sub as OrganismoSuscripcion | null) ?? null)
      }
    } catch {
      // fallo silencioso
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (refreshInProgress.current) return
    refreshInProgress.current = true

    try {
      setLoading(true)

      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser ?? null)

      if (!authUser) {
        setProfile(null)
        setOrganismoActivo(null)
        setRolEnOrganismo(null)
        setSuscripcion(null)
        setMisOrganismos([])
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('perfiles_usuario')
        .select('id, email, nombre_completo, avatar_url, preferencias, tipo_usuario_id, created_at, updated_at, tipo_usuario:tipos_usuario(id, codigo, nombre, descripcion, created_at)')
        .eq('id', authUser.id)
        .maybeSingle()

      const row = data as SessionProfileRow | null
      const fallbackName =
        typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name.trim() : null
      const fallbackAvatar =
        typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url.trim() : null

      setProfile({
        id: authUser.id,
        email: row?.email ?? authUser.email ?? '',
        nombre_completo: row?.nombre_completo ?? fallbackName,
        avatar_url: row?.avatar_url ?? fallbackAvatar,
        preferencias: normalizarPreferenciasUsuario(row?.preferencias),
        tipo_usuario_id: row?.tipo_usuario_id ?? null,
        created_at: row?.created_at,
        updated_at: row?.updated_at ?? authUser.updated_at,
        tipo_usuario: normalizarTipoUsuario(row?.tipo_usuario),
      })

      await loadOrganismoData(authUser.id)
    } finally {
      setLoading(false)
      refreshInProgress.current = false
    }
  }, [loadOrganismoData])

  const refreshOrganismo = useCallback(async () => {
    if (!user) return
    await loadOrganismoData(user.id)
  }, [user, loadOrganismoData])

  const cambiarOrganismo = useCallback(async (organismoId: string) => {
    const match = misOrganismos.find((o) => o.organismo_id === organismoId)
    if (!match) return

    // Actualizar cookie
    document.cookie = `${ORGANISMO_COOKIE}=${organismoId}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`

    setOrganismoActivo(match.organismo)
    setRolEnOrganismo(match.rol_codigo)

    if (user) await loadOrganismoData(user.id)

    // Recargar para que el middleware resuelva el nuevo organismo
    window.location.href = '/dashboard'
  }, [misOrganismos, user, loadOrganismoData])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      if (!mounted) return
      await refreshProfile()
    }
    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) {
        void refreshProfile()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [refreshProfile])

  const value = useMemo<UserSessionContextValue>(
    () => {
      const capabilities = rolEnOrganismo
        ? getRoleCapabilitiesForCode(rolEnOrganismo)
        : getRoleCapabilities(profile)

      return {
        user,
        profile,
        loading,
        refreshProfile,
        isAdmin: rolEnOrganismo
          ? ADMIN_ROLE_CODES.includes(rolEnOrganismo as (typeof ADMIN_ROLE_CODES)[number])
          : hasAnyRole(profile, ADMIN_ROLE_CODES),
        canEditAgenda: capabilities.canCreateTasks || capabilities.canEditTasks || capabilities.canDeleteTasks,
        capabilities,
        organismoActivo,
        rolEnOrganismo,
        suscripcion,
        misOrganismos,
        cambiarOrganismo,
        refreshOrganismo,
      }
    },
    [loading, profile, refreshProfile, user, organismoActivo, rolEnOrganismo, suscripcion, misOrganismos, cambiarOrganismo, refreshOrganismo]
  )

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>
}

export function useUserSession() {
  const context = useContext(UserSessionContext)

  if (!context) {
    throw new Error('useUserSession must be used within UserSessionProvider')
  }

  return context
}
