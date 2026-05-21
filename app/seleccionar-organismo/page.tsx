'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus } from 'lucide-react'
import { useUserSession } from '@/components/UserSessionProvider'
import { ORGANISMO_COOKIE } from '@/lib/organismo-access'

export default function SeleccionarOrganismoPage() {
  const { misOrganismos, loading } = useUserSession()
  const router = useRouter()
  const [selecting, setSelecting] = useState(false)

  const seleccionar = useCallback((organismoId: string) => {
    setSelecting(true)
    document.cookie = `${ORGANISMO_COOKIE}=${organismoId}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    router.replace('/dashboard')
  }, [router])

  useEffect(() => {
    if (!loading && misOrganismos.length === 1) {
      seleccionar(misOrganismos[0].organismo_id)
    }
  }, [loading, misOrganismos, seleccionar])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    )
  }

  if (misOrganismos.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold text-slate-900">Sin organismos</h1>
        <p className="mt-2 text-slate-500">No perteneces a ningún organismo todavía.</p>
        <a
          href="/organismos/nuevo"
          className="mt-6 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Crear organismo
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Building2 size={40} className="mx-auto text-teal-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Selecciona un organismo</h1>
          <p className="mt-2 text-slate-500">Elige con qué organismo quieres trabajar ahora.</p>
        </div>

        <div className="space-y-3">
          {misOrganismos.map(({ organismo_id, rol_codigo, organismo }) => (
            <button
              key={organismo_id}
              type="button"
              disabled={selecting}
              onClick={() => seleccionar(organismo_id)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition-all hover:border-teal-300 hover:bg-teal-50 disabled:opacity-60"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                {organismo?.nombre?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{organismo?.nombre ?? 'Organismo'}</p>
                <p className="text-xs capitalize text-slate-500">{rol_codigo}</p>
              </div>
            </button>
          ))}
        </div>

        <a
          href="/organismos/nuevo"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-4 text-sm text-slate-500 transition-colors hover:border-teal-400 hover:text-teal-600"
        >
          <Plus size={16} />
          Crear nuevo organismo
        </a>
      </div>
    </div>
  )
}
