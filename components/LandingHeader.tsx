'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 12)
    updateScrolled()
    window.addEventListener('scroll', updateScrolled, { passive: true })
    return () => window.removeEventListener('scroll', updateScrolled)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[200] px-4 py-3 transition-[background-color,border-color,box-shadow] duration-300 sm:px-6',
        scrolled
          ? 'border-b border-transparent bg-transparent shadow-none'
          : 'border-b border-[var(--surface-strong-border)] bg-[var(--surface-strong-bg)] shadow-[0_16px_42px_rgba(15,23,42,0.07)]'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="logo-panel relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-2xl border shadow-[0_14px_34px_rgba(15,23,42,0.12)]">
            <Image src="/logo/Icon-S.png" alt="Logo de SEGESA" fill sizes="44px" className="object-contain p-1.5" priority />
          </span>
          <span className="min-w-0">
            <span className={cn('block text-lg font-semibold uppercase leading-tight', scrolled ? 'text-white drop-shadow-[0_2px_8px_rgba(15,23,42,0.55)]' : 'text-slate-900')}>
              SEGESA
            </span>
            <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
              Agenda Corporativa
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {[
            ['Soluciones', '#funciones'],
            ['Funciones', '#funciones'],
            ['Precios', '#planes'],
            ['Recursos', '#contacto'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className={cn(
                'text-sm font-semibold transition-colors',
                scrolled
                  ? 'text-white drop-shadow-[0_2px_8px_rgba(15,23,42,0.55)] hover:text-teal-100'
                  : 'text-slate-700 hover:text-teal-700'
              )}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          <ThemeToggle
            className={cn(
              'h-11 min-w-11 px-3 sm:[&>span]:hidden',
              scrolled
                ? 'border-white/20 bg-white/10 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] hover:bg-white/15 hover:text-white'
                : ''
            )}
          />
          <Link href="/login" className="action-btn hidden h-11 sm:inline-flex">
            Iniciar sesion
          </Link>
          <Link href="#contacto" className="action-btn-primary h-11 px-3 sm:px-4">
            <span className="hidden sm:inline">Registrarse</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  )
}
