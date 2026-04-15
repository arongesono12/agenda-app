import { createServerSupabaseClient } from '@/lib/supabase-server'
import { normalizarPreferenciasUsuario } from '@/lib/user-preferences'
import type { PerfilUsuario, TipoUsuario } from '@/lib/types'

type ServerProfileRow = Omit<PerfilUsuario, 'tipo_usuario'> & {
  tipo_usuario?: TipoUsuario | TipoUsuario[] | null
}

function normalizarTipoUsuario(value?: TipoUsuario | TipoUsuario[] | null) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getServerSessionProfile() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      profile: null,
    }
  }

  const { data } = await supabase
    .from('perfiles_usuario')
    .select('id, email, nombre_completo, avatar_url, preferencias, tipo_usuario_id, created_at, updated_at, tipo_usuario:tipos_usuario(id, codigo, nombre, descripcion, created_at)')
    .eq('id', user.id)
    .maybeSingle()

  const row = data as ServerProfileRow | null

  return {
    user,
    profile: {
      id: user.id,
      email: row?.email ?? user.email ?? '',
      nombre_completo:
        row?.nombre_completo ??
        (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null),
      avatar_url:
        row?.avatar_url ??
        (typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null),
      preferencias: normalizarPreferenciasUsuario(row?.preferencias),
      tipo_usuario_id: row?.tipo_usuario_id ?? null,
      created_at: row?.created_at,
      updated_at: row?.updated_at ?? user.updated_at,
      tipo_usuario: normalizarTipoUsuario(row?.tipo_usuario),
    } satisfies PerfilUsuario,
  }
}
