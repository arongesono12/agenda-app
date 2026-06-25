import type { PerfilUsuario } from '@/lib/types'

export const ADMIN_ROLE_CODES = ['superusuario', 'administrador', 'administradora'] as const
export const MANAGER_ROLE_CODES = ['superusuario', 'administrador', 'administradora', 'supervisor'] as const
export const EDITOR_ROLE_CODES = ['superusuario', 'administrador', 'administradora', 'supervisor', 'responsable'] as const
export const READER_ROLE_CODES = ['superusuario', 'administrador', 'administradora', 'supervisor', 'responsable', 'consulta'] as const

export type RoleCode = (typeof READER_ROLE_CODES)[number]

const ADMIN_ROUTES = ['/agenda', '/mis-tareas', '/dashboard', '/alertas', '/calendario', '/reuniones', '/cronograma', '/estadisticas', '/busqueda', '/responsable', '/historial', '/catalogos']
const SUPERVISOR_ROUTES = ['/agenda', '/mis-tareas', '/dashboard', '/alertas', '/calendario', '/reuniones', '/cronograma', '/estadisticas', '/busqueda', '/responsable', '/historial']
const RESPONSABLE_ROUTES = ['/agenda', '/mis-tareas', '/dashboard', '/alertas', '/calendario', '/reuniones', '/cronograma', '/historial']
const CONSULTA_ROUTES = ['/mis-tareas', '/dashboard', '/alertas', '/calendario', '/reuniones', '/busqueda', '/cronograma', '/estadisticas']
const COMMON_AUTH_ROUTES = ['/perfil', '/configuracion', '/forbidden']

// Rutas de organismos accesibles por cualquier usuario autenticado
const ORGANISMO_ROUTES = ['/seleccionar-organismo', '/organismos']

// Rutas públicas (sin auth)
export const PUBLIC_ROUTES = ['/', '/planes']

export function getLandingPathForRole(roleCode: string) {
  const normalized = roleCode.trim().toLowerCase()
  if (normalized === 'responsable') return '/agenda'
  return '/dashboard'
}

export function getAllowedRoutesForRole(roleCode: string) {
  const normalized = roleCode.trim().toLowerCase()

  if (ADMIN_ROLE_CODES.includes(normalized as (typeof ADMIN_ROLE_CODES)[number])) {
    return [...ADMIN_ROUTES, ...COMMON_AUTH_ROUTES, ...ORGANISMO_ROUTES]
  }

  if (normalized === 'supervisor') {
    return [...SUPERVISOR_ROUTES, ...COMMON_AUTH_ROUTES, ...ORGANISMO_ROUTES]
  }

  if (normalized === 'responsable') {
    return [...RESPONSABLE_ROUTES, ...COMMON_AUTH_ROUTES, ...ORGANISMO_ROUTES]
  }

  return [...CONSULTA_ROUTES, ...COMMON_AUTH_ROUTES, ...ORGANISMO_ROUTES]
}

export function canAccessPathForRole(roleCode: string, pathname: string) {
  if (pathname.startsWith('/api/')) return true

  // Rutas de organismos siempre accesibles para usuarios autenticados
  if (pathname.startsWith('/organismos') || pathname === '/seleccionar-organismo') return true

  // Rutas públicas
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return true

  return getAllowedRoutesForRole(roleCode).some((route) => {
    if (route === '/') return pathname === '/'
    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

export function normalizarRoleCode(profile?: PerfilUsuario | null): string {
  return profile?.tipo_usuario?.codigo?.trim().toLowerCase() ?? 'consulta'
}

export function hasAnyRole(profile: PerfilUsuario | null | undefined, allowedRoles: readonly string[]) {
  const roleCode = normalizarRoleCode(profile)
  return allowedRoles.includes(roleCode)
}
