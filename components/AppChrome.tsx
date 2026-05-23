'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'
import { UserSessionProvider } from '@/components/UserSessionProvider'
import { ToastProvider } from '@/components/ToastProvider'

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const AUTH_ROUTES = ['/login', '/registro', '/recuperar-password', '/actualizar-password']
  const PUBLIC_FULL_PAGE_ROUTES = ['/planes']
  const isAuthRoute = AUTH_ROUTES.includes(pathname)
  const isPublicFullPageRoute = PUBLIC_FULL_PAGE_ROUTES.includes(pathname)

  return (
    <UserSessionProvider>
      <ThemeProvider>
        <ToastProvider>
          <div className="app-shell">
            {isAuthRoute || isPublicFullPageRoute ? (
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
        </ToastProvider>
      </ThemeProvider>
    </UserSessionProvider>
  )
}
