'use client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useUserSession } from '@/components/UserSessionProvider'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'agenda-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: sessionLoading } = useUserSession()
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (sessionLoading) return

    const saved = window.localStorage.getItem(STORAGE_KEY)
    const profileTheme = profile?.preferencias?.theme
    const nextTheme: Theme =
      profileTheme === 'dark' || profileTheme === 'light'
        ? profileTheme
        : saved === 'dark'
          ? 'dark'
          : 'light'
    setThemeState(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
    setMounted(true)
  }, [profile?.preferencias?.theme, sessionLoading])

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
  }

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      mounted,
    }),
    [theme, mounted]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
