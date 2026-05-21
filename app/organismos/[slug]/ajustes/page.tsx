'use client'

import { useEffect, useState, use } from 'react'
import { Building2, Loader2, Save } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { useUserSession } from '@/components/UserSessionProvider'

const SECTORES = [
  'Tecnología', 'Salud', 'Educación', 'Finanzas', 'Construcción',
  'Comercio', 'Logística', 'Energía', 'Telecomunicaciones', 'Gobierno',
  'Servicios', 'Otro',
]

interface OrganismoData {
  id: string
  nombre: string
  slug: string
  tipo: 'individual' | 'corporativo'
  sector?: string | null
  website?: string | null
}

export default function AjustesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { rolEnOrganismo } = useUserSession()
  const esAdmin = rolEnOrganismo && ['administrador', 'administradora'].includes(rolEnOrganismo)

  const [organismo, setOrganismo] = useState<OrganismoData | null>(null)
  const [nombre, setNombre] = useState('')
  const [sector, setSector] = useState('')
  const [website, setWebsite] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/organismos/${slug}/ajustes`)
        if (res.ok) {
          const data = await res.json()
          const org = data.organismo as OrganismoData
          setOrganismo(org)
          setNombre(org.nombre ?? '')
          setSector(org.sector ?? '')
          setWebsite(org.website ?? '')
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch(`/api/organismos/${slug}/ajustes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), sector: sector || null, website: website.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al guardar.')
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-layout">
        <PageHeader title="Ajustes del organismo" subtitle="Configura los datos básicos de tu organismo." icon={<Building2 size={22} />} />
        <div className="surface-panel-strong flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-teal-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-layout">
      <PageHeader
        title="Ajustes del organismo"
        subtitle="Configura los datos básicos de tu organismo."
        icon={<Building2 size={22} />}
      />

      <div className="surface-panel-strong overflow-hidden p-6">
        {!esAdmin && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Solo los administradores pueden modificar los ajustes del organismo.
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}
        {success && (
          <div className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">Cambios guardados correctamente.</div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="max-w-lg space-y-5">
          <div>
            <label className="label-field">Nombre del organismo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
              disabled={!esAdmin}
              className="input-shell disabled:opacity-60"
              placeholder="Nombre de tu organismo"
            />
          </div>

          <div>
            <label className="label-field">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              disabled={!esAdmin}
              className="input-shell disabled:opacity-60"
            >
              <option value="">Sin especificar</option>
              {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="label-field">Sitio web</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={!esAdmin}
              className="input-shell disabled:opacity-60"
              placeholder="https://ejemplo.com"
            />
          </div>

          {esAdmin && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving || !nombre.trim()}
                className="action-btn-primary disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Guardar cambios
              </button>
            </div>
          )}
        </form>

        {organismo && (
          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400">ID del organismo: <span className="font-mono">{organismo.id}</span></p>
            <p className="mt-1 text-xs text-slate-400">Slug: <span className="font-mono">{organismo.slug}</span></p>
          </div>
        )}
      </div>
    </div>
  )
}
