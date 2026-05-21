import type { User } from '@supabase/supabase-js'
import { ADMIN_ROLE_CODES, normalizarRoleCode } from '@/lib/access-control'
import type { PerfilUsuario } from '@/lib/types'

export type TaskScope = {
  unrestricted: boolean
  userId: string | null
  assignedNames: string[]
  organismoId?: string | null
}

type ScopedQuery = {
  eq(column: string, value: unknown): ScopedQuery
  in(column: string, values: unknown[]): ScopedQuery
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => !!value)
    )
  )
}

export function buildTaskScope(
  user: User,
  profile: PerfilUsuario | null | undefined,
  organismoId?: string,
  activeRoleCode?: string
): TaskScope {
  const roleCode = activeRoleCode?.trim().toLowerCase() || normalizarRoleCode(profile)

  if (ADMIN_ROLE_CODES.includes(roleCode as (typeof ADMIN_ROLE_CODES)[number])) {
    return {
      unrestricted: true,
      userId: user.id,
      assignedNames: [],
      organismoId: organismoId || null,
    }
  }

  const email = profile?.email || user.email || ''
  const emailName = email.split('@')[0]?.replace(/[._-]+/g, ' ')

  return {
    unrestricted: false,
    userId: user.id,
    assignedNames: uniqueValues([profile?.nombre_completo, emailName]),
    organismoId: organismoId || null,
  }
}

export function applyTaskScope<TQuery extends ScopedQuery>(
  query: TQuery,
  scope: TaskScope,
  options: { includeUserColumn?: boolean } = {}
) {
  let q = query

  // Filtrar por organismo si está disponible
  if (scope.organismoId) {
    q = q.eq('organismo_id', scope.organismoId) as TQuery
  }

  if (scope.unrestricted) return q

  if (options.includeUserColumn !== false && scope.userId) {
    return q.eq('responsable_usuario_id', scope.userId) as TQuery
  }

  if (scope.assignedNames.length > 0) {
    return q.in('responsable', scope.assignedNames) as TQuery
  }

  return q.eq('id', -1) as TQuery
}

export function isTaskScopeColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /responsable_usuario_id|column .* does not exist/i.test(message)
  )
}
