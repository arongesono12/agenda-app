import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import AppChrome from '@/components/AppChrome'

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
  icons: {
    icon: '/logo/Icon-segesa.ico',
    shortcut: '/logo/Icon-segesa.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppinsSans.variable} ${poppinsDisplay.variable}`}>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  )
}
