import type { SupabaseClient } from '@supabase/supabase-js'
import type { RolCodigo, Organismo, OrganismoSuscripcion } from '@/lib/types'
import { SEGESA_ORGANISMO_ID } from '@/lib/types'

export const ORGANISMO_COOKIE = 'organismo_activo_id'

export function esOrganismoSegesa(organismoId?: string | null) {
  return organismoId === SEGESA_ORGANISMO_ID
}

export function getSuscripcionSegesaExenta(): OrganismoSuscripcion {
  return {
    organismo_id: SEGESA_ORGANISMO_ID,
    plan_codigo: 'empresa',
    estado: 'activa',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    periodo_inicio: null,
    periodo_fin: null,
    trial_fin: null,
  }
}

export async function resolverRolActivo(
  supabase: SupabaseClient,
  usuarioId: string,
  organismoId: string
): Promise<RolCodigo | null> {
  const { data } = await supabase
    .from('organismo_miembros')
    .select('rol_codigo')
    .eq('usuario_id', usuarioId)
    .eq('organismo_id', organismoId)
    .eq('activo', true)
    .maybeSingle()

  return (data?.rol_codigo as RolCodigo) ?? null
}

export async function listarOrganismosDeUsuario(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<Array<{ organismo_id: string; rol_codigo: RolCodigo; organismo: Organismo | null }>> {
  const { data, error } = await supabase
    .from('organismo_miembros')
    .select('organismo_id, rol_codigo, organismo:organismos(id, nombre, slug, tipo, logo_url, activo)')
    .eq('usuario_id', usuarioId)
    .eq('activo', true)

  if (error || !data) return []

  return data.map((row) => ({
    organismo_id: row.organismo_id as string,
    rol_codigo: row.rol_codigo as RolCodigo,
    organismo: (Array.isArray(row.organismo) ? row.organismo[0] : row.organismo) as Organismo | null,
  }))
}

export async function resolverOrganismoActivo(
  supabase: SupabaseClient,
  usuarioId: string,
  cookieOrganismoId: string | null,
  userEmail?: string | null
): Promise<{ organismoId: string | null; rol: RolCodigo | null; redirigir: string | null }> {
  const organismos = await listarOrganismosDeUsuario(supabase, usuarioId)

  if (organismos.length === 0) {
    if (userEmail?.toLowerCase().endsWith('@segesa.gq')) {
      await agregarMiembro(supabase, SEGESA_ORGANISMO_ID, usuarioId, 'responsable')
      return { organismoId: SEGESA_ORGANISMO_ID, rol: 'responsable', redirigir: null }
    }
    return { organismoId: null, rol: null, redirigir: '/organismos/nuevo' }
  }

  // Verificar cookie
  if (cookieOrganismoId) {
    const match = organismos.find((o) => o.organismo_id === cookieOrganismoId)
    if (match) {
      return { organismoId: match.organismo_id, rol: match.rol_codigo, redirigir: null }
    }
  }

  // En la instancia Segesa, el organismo semilla es el contexto por defecto.
  const segesa = organismos.find((o) => o.organismo_id === SEGESA_ORGANISMO_ID)
  if (segesa) {
    return { organismoId: segesa.organismo_id, rol: segesa.rol_codigo, redirigir: null }
  }

  // Auto-resolver si solo tiene uno
  if (organismos.length === 1) {
    return { organismoId: organismos[0].organismo_id, rol: organismos[0].rol_codigo, redirigir: null }
  }

  // Múltiples organismos sin cookie válida
  return { organismoId: null, rol: null, redirigir: '/seleccionar-organismo' }
}

export async function obtenerSuscripcion(
  supabase: SupabaseClient,
  organismoId: string
): Promise<OrganismoSuscripcion | null> {
  if (esOrganismoSegesa(organismoId)) {
    return getSuscripcionSegesaExenta()
  }

  const { data } = await supabase
    .from('organismo_suscripciones')
    .select('*')
    .eq('organismo_id', organismoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as OrganismoSuscripcion | null
}

export function suscripcionActiva(suscripcion: OrganismoSuscripcion | null): boolean {
  if (!suscripcion) return false
  if (suscripcion.estado === 'activa') return true
  if (suscripcion.estado === 'prueba') {
    const trialFin = suscripcion.trial_fin ? new Date(suscripcion.trial_fin) : null
    return trialFin ? trialFin > new Date() : false
  }
  return false
}

export function esSuscripcionEnPrueba(suscripcion: OrganismoSuscripcion | null): boolean {
  if (!suscripcion) return false
  return suscripcion.estado === 'prueba'
}

export function getOrganismoIdFromHeaders(headers: Headers): string {
  return headers.get('x-organismo-id') ?? ''
}

export async function crearOrganismo(
  supabase: SupabaseClient,
  payload: {
    nombre: string
    slug: string
    tipo: 'individual' | 'corporativo'
    sector?: string
    pais?: string
    creadoPor: string
  }
): Promise<Organismo> {
  const { data, error } = await supabase
    .from('organismos')
    .insert({
      nombre: payload.nombre.trim(),
      slug: payload.slug.trim().toLowerCase(),
      tipo: payload.tipo,
      sector: payload.sector || null,
      pais: payload.pais || 'ES',
      creado_por: payload.creadoPor,
      activo: true,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Organismo
}

export async function agregarMiembro(
  supabase: SupabaseClient,
  organismoId: string,
  usuarioId: string,
  rolCodigo: RolCodigo,
  invitadoPor?: string
): Promise<void> {
  const { error } = await supabase
    .from('organismo_miembros')
    .upsert(
      {
        organismo_id: organismoId,
        usuario_id: usuarioId,
        rol_codigo: rolCodigo,
        activo: true,
        invitado_por: invitadoPor ?? null,
      },
      { onConflict: 'organismo_id,usuario_id' }
    )

  if (error) throw error
}

export function generarSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

export { SEGESA_ORGANISMO_ID }
