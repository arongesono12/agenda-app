import type { PerfilUsuario } from '@/lib/types'

export const ADMIN_ROLE_CODES = ['administrador', 'administradora'] as const
export const MANAGER_ROLE_CODES = ['administrador', 'administradora', 'supervisor'] as const
export const EDITOR_ROLE_CODES = ['administrador', 'administradora', 'supervisor', 'responsable'] as const
export const READER_ROLE_CODES = ['administrador', 'administradora', 'supervisor', 'responsable', 'consulta'] as const

export type RoleCode = (typeof READER_ROLE_CODES)[number]

export function normalizarRoleCode(profile?: PerfilUsuario | null): string {
  return profile?.tipo_usuario?.codigo?.trim().toLowerCase() ?? 'consulta'
}

export function hasAnyRole(profile: PerfilUsuario | null | undefined, allowedRoles: readonly string[]) {
  const roleCode = normalizarRoleCode(profile)
  return allowedRoles.includes(roleCode)
}
