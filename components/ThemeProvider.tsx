'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ThemePreference } from '@/lib/types'
import { normalizarPreferenciasUsuario } from '@/lib/user-preferences'
import { useUserSession } from '@/components/UserSessionProvider'

type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  setThemePreference: (theme: ThemePreference, options?: { persist?: boolean }) => Promise<void>
  toggleTheme: () => Promise<void>
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'agenda-theme'
const SYSTEM_QUERY = '(prefers-color-scheme: dark)'

function getStoredThemePreference(): ThemePreference | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : null
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light'
}

function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === 'system' ? systemTheme : preference
}

function applyTheme(resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: sessionLoading, refreshProfile } = useUserSession()
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const storedPreference = getStoredThemePreference() ?? 'system'
    const systemTheme = getSystemTheme()
    const nextResolvedTheme = resolveTheme(storedPreference, systemTheme)

    setThemePreferenceState(storedPreference)
    setResolvedTheme(nextResolvedTheme)
    applyTheme(nextResolvedTheme)
    setMounted(true)

    const mediaQuery = window.matchMedia(SYSTEM_QUERY)

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const nextSystemTheme: ResolvedTheme = event.matches ? 'dark' : 'light'
      setResolvedTheme((current) => {
        const nextResolved = resolveTheme(themePreference === 'system' ? 'system' : getStoredThemePreference() ?? themePreference, nextSystemTheme)
        if ((getStoredThemePreference() ?? themePreference) === 'system') {
          applyTheme(nextResolved)
          return nextResolved
        }
        return current
      })
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [themePreference])

  useEffect(() => {
    if (sessionLoading) return

    const profilePreference = profile?.preferencias?.theme
    const nextPreference: ThemePreference =
      profilePreference === 'light' || profilePreference === 'dark' || profilePreference === 'system'
        ? profilePreference
        : getStoredThemePreference() ?? 'system'

    const nextResolvedTheme = resolveTheme(nextPreference, getSystemTheme())
    setThemePreferenceState(nextPreference)
    setResolvedTheme(nextResolvedTheme)
    applyTheme(nextResolvedTheme)
    window.localStorage.setItem(STORAGE_KEY, nextPreference)
  }, [profile?.preferencias?.theme, sessionLoading])

  const setThemePreference = useCallback(async (
    nextPreference: ThemePreference,
    options?: { persist?: boolean }
  ) => {
    const persist = options?.persist ?? true
    const nextResolvedTheme = resolveTheme(nextPreference, getSystemTheme())

    setThemePreferenceState(nextPreference)
    setResolvedTheme(nextResolvedTheme)
    applyTheme(nextResolvedTheme)
    window.localStorage.setItem(STORAGE_KEY, nextPreference)

    if (!persist || !user) return

    const normalizedPreferences = normalizarPreferenciasUsuario(profile?.preferencias)

    const { error } = await supabase.from('perfiles_usuario').upsert(
      {
        id: user.id,
        email: user.email ?? profile?.email ?? '',
        nombre_completo:
          profile?.nombre_completo ??
          (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null),
        avatar_url:
          profile?.avatar_url ??
          (typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null),
        tipo_usuario_id: profile?.tipo_usuario_id ?? null,
        preferencias: {
          ...normalizedPreferences,
          theme: nextPreference,
        },
      },
      { onConflict: 'id' }
    )

    if (!error) {
      await refreshProfile()
    }
  }, [profile?.avatar_url, profile?.email, profile?.nombre_completo, profile?.preferencias, profile?.tipo_usuario_id, refreshProfile, user])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      toggleTheme: () => setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark'),
      mounted,
    }),
    [themePreference, resolvedTheme, mounted, setThemePreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
