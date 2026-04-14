'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = pathname === '/login'

  return (
    <ThemeProvider>
      <div className="app-shell">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
          <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-orange-200/20 blur-3xl" />
        </div>

        {isAuthRoute ? (
          <main className="relative min-h-screen">
            {children}
          </main>
        ) : (
          <div className="relative flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <div className="page-shell">{children}</div>
            </main>
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}
