'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { PerfilUsuario, TipoUsuario } from '@/lib/types'
import { normalizarPreferenciasUsuario } from '@/lib/user-preferences'
import { hasAnyRole, ADMIN_ROLE_CODES, EDITOR_ROLE_CODES } from '@/lib/access-control'

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

  const refreshProfile = useCallback(async () => {
    setLoading(true)

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    setUser(authUser ?? null)

    if (!authUser) {
      setProfile(null)
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
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile()
    })

    return () => subscription.unsubscribe()
  }, [refreshProfile])

  const value = useMemo<UserSessionContextValue>(
    () => ({
      user,
      profile,
      loading,
      refreshProfile,
      isAdmin: hasAnyRole(profile, ADMIN_ROLE_CODES),
      canEditAgenda: hasAnyRole(profile, EDITOR_ROLE_CODES),
    }),
    [loading, profile, refreshProfile, user]
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
