import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

export type OrganismoDirectoryMember = {
  id: number
  organismo_id: string
  usuario_id: string
  rol_codigo: string
  activo: boolean
  invitado_por: string | null
  created_at: string | null
  perfil: {
    nombre_completo: string | null
    email: string
    avatar_url: string | null
  }
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function loadActiveOrganismoDirectory(
  admin: AdminClient,
  organismoId: string,
  usuarioIds?: string[]
): Promise<OrganismoDirectoryMember[]> {
  const uniqueUserIds = usuarioIds ? Array.from(new Set(usuarioIds.filter(Boolean))) : null
  if (uniqueUserIds && uniqueUserIds.length === 0) return []

  let memberQuery = admin
    .from('organismo_miembros')
    .select('id, organismo_id, usuario_id, rol_codigo, activo, invitado_por, created_at')
    .eq('organismo_id', organismoId)
    .eq('activo', true)

  if (uniqueUserIds) memberQuery = memberQuery.in('usuario_id', uniqueUserIds)

  const { data: members, error: membersError } = await memberQuery.order('created_at', { ascending: true })
  if (membersError) throw membersError
  if (!members?.length) return []

  const memberUserIds = members.map((member) => member.usuario_id)
  const { data: profiles, error: profilesError } = await admin
    .from('perfiles_usuario')
    .select('id, nombre_completo, email, avatar_url')
    .in('id', memberUserIds)

  if (profilesError) throw profilesError

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const missingProfileIds = memberUserIds.filter((id) => !profilesById.get(id)?.email?.trim())
  const authUsers = await Promise.all(
    missingProfileIds.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error || !data.user?.email) return null
      return data.user
    })
  )
  const authUsersById = new Map(authUsers.filter(Boolean).map((user) => [user!.id, user!]))

  return members.map((member) => {
    const profile = profilesById.get(member.usuario_id)
    const authUser = authUsersById.get(member.usuario_id)
    const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>

    return {
      ...member,
      perfil: {
        nombre_completo:
          profile?.nombre_completo?.trim() ||
          metadataText(metadata, 'full_name') ||
          metadataText(metadata, 'nombre_completo'),
        email: (profile?.email || authUser?.email || '').trim().toLowerCase(),
        avatar_url:
          profile?.avatar_url?.trim() ||
          metadataText(metadata, 'avatar_url'),
      },
    }
  })
}
