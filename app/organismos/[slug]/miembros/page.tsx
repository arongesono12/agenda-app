'use client'

import { useCallback, useEffect, useState, use } from 'react'
import { UserPlus } from 'lucide-react'
import MiembrosTable from '@/components/MiembrosTable'
import InvitarMiembroModal from '@/components/InvitarMiembroModal'
import PageHeader from '@/components/ui/PageHeader'
import { useUserSession } from '@/components/UserSessionProvider'
import type { MiembroConPerfil } from '@/lib/types'

export default function MiembrosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { rolEnOrganismo } = useUserSession()
  const [miembros, setMiembros] = useState<MiembroConPerfil[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvitar, setShowInvitar] = useState(false)

  const puedeInvitar = rolEnOrganismo && ['administrador', 'administradora', 'supervisor'].includes(rolEnOrganismo)
  const esAdmin = rolEnOrganismo && ['administrador', 'administradora'].includes(rolEnOrganismo)

  const loadMiembros = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/organismos/${slug}/miembros`)
      if (res.ok) {
        const data = await res.json()
        setMiembros(data.miembros ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void loadMiembros() }, [loadMiembros])

  return (
    <div className="page-layout">
      <PageHeader
        title="Miembros"
        subtitle="Gestiona quién tiene acceso al organismo y con qué rol."
        actions={
          puedeInvitar ? (
            <button
              type="button"
              onClick={() => setShowInvitar(true)}
              className="action-btn-primary"
            >
              <UserPlus size={15} />
              Invitar miembro
            </button>
          ) : null
        }
      />

      <MiembrosTable
        miembros={miembros}
        loading={loading}
        slug={slug}
        esAdmin={!!esAdmin}
        onUpdated={loadMiembros}
      />

      {showInvitar && (
        <InvitarMiembroModal
          slug={slug}
          onClose={() => setShowInvitar(false)}
          onInvited={() => { setShowInvitar(false); void loadMiembros() }}
        />
      )}
    </div>
  )
}
