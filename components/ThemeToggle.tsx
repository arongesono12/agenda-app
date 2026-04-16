'use client'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'

export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, themePreference, toggleTheme, mounted } = useTheme()

  return (
    <button
      type="button"
      onClick={() => void toggleTheme()}
      className={cn('action-btn h-11 min-w-11 rounded-2xl px-3', className)}
      aria-label={mounted && resolvedTheme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={
        mounted
          ? themePreference === 'system'
            ? `Tema del sistema (${resolvedTheme === 'dark' ? 'oscuro' : 'claro'})`
            : `Tema ${resolvedTheme === 'dark' ? 'oscuro' : 'claro'}`
          : 'Cambiar tema'
      }
    >
      {mounted && resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span className="hidden sm:inline">
        {mounted && resolvedTheme === 'dark' ? 'Claro' : 'Oscuro'}
      </span>
    </button>
  )
}
