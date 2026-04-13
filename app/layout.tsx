import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'

const poppinsSans = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

const poppinsDisplay = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Control Automatizado - Plan de Trabajo',
  description: 'Sistema de gestion de tareas, alertas y seguimiento operativo.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppinsSans.variable} ${poppinsDisplay.variable}`}>
        <ThemeProvider>
          <div className="app-shell">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
              <div className="absolute right-0 top-20 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-orange-200/20 blur-3xl" />
            </div>

            <div className="relative flex min-h-screen">
              <Sidebar />
              <main className="min-w-0 flex-1 overflow-y-auto">
                <div className="page-shell">{children}</div>
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
