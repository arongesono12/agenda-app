'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Plus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useUserSession } from '@/components/UserSessionProvider'

export default function OrganismoSelector({ collapsed = false }: { collapsed?: boolean }) {
  const { organismoActivo, misOrganismos, cambiarOrganismo } = useUserSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  if (!organismoActivo && misOrganismos.length === 0) return null

  const nombre = organismoActivo?.nombre ?? 'Organismo'
  const initial = nombre.charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        title={collapsed ? nombre : undefined}
        className={cn(
          'group flex w-full items-center rounded-2xl border border-white/70 bg-white/70 transition-all hover:bg-white/90',
          collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2.5'
        )}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-teal-100 text-sm font-bold text-teal-700">
          {initial}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-900">{nombre}</span>
            <ChevronDown size={13} className={cn('flex-shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-30 overflow-hidden rounded-[20px] border border-white/80 bg-white/90 p-1.5 shadow-[0_20px_44px_rgba(15,23,42,0.14)] backdrop-blur-xl',
            collapsed ? 'left-[calc(100%+0.75rem)] top-0 w-60' : 'inset-x-0 top-[calc(100%+0.5rem)]'
          )}
        >
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Organismos</p>
          <ul className="space-y-0.5">
            {misOrganismos.map(({ organismo_id, organismo }) => {
              const isActive = organismo_id === organismoActivo?.id
              const orgNombre = organismo?.nombre ?? 'Organismo'
              return (
                <li key={organismo_id}>
                  <button
                    type="button"
                    onClick={() => { void cambiarOrganismo(organismo_id); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-100 text-xs font-bold text-teal-600">
                      {orgNombre.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{orgNombre}</span>
                    {isActive && <Check size={14} className="flex-shrink-0 text-teal-500" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mx-2 my-1.5 border-t border-slate-100" />
          <Link
            href="/organismos/nuevo"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300">
              <Plus size={12} />
            </span>
            Crear nuevo organismo
          </Link>
        </div>
      )}
    </div>
  )
}
