import { getLandingPathForRole, getAllowedRoutesForRole, normalizarRoleCode } from '@/lib/access-control'
import type { PerfilUsuario } from '@/lib/types'

export type RoleCapabilitySet = {
  roleCode: string
  landingPath: string
  dashboardTitle: string
  dashboardSubtitle: string
  agendaTitle: string
  agendaSubtitle: string
  canCreateTasks: boolean
  canEditTasks: boolean
  canDeleteTasks: boolean
  canUpdateAssignedTasks: boolean
  canManageCatalogs: boolean
  canViewGlobalDashboard: boolean
  canViewSearch: boolean
  canViewStatistics: boolean
  canViewResponsibleBoard: boolean
  canViewHistory: boolean
  navItems: string[]
}

const NAV_ONLY = new Set(['/', '/dashboard', '/alertas', '/cronograma', '/estadisticas', '/busqueda', '/responsable', '/historial', '/catalogos'])

function navItemsForRole(roleCode: string) {
  return getAllowedRoutesForRole(roleCode).filter((route) => NAV_ONLY.has(route))
}

export function getRoleCapabilitiesForCode(roleCode: string): RoleCapabilitySet {
  if (roleCode === 'administrador' || roleCode === 'administradora') {
    return {
      roleCode,
      landingPath: getLandingPathForRole(roleCode),
      dashboardTitle: 'Dashboard ejecutivo',
      dashboardSubtitle: 'Indicadores globales de rendimiento, carga operativa y estado del equipo.',
      agendaTitle: 'Agenda de control',
      agendaSubtitle: 'Vista diaria del equipo. Gestiona prioridades, vencimientos y responsables desde un panel central.',
      canCreateTasks: true,
      canEditTasks: true,
      canDeleteTasks: true,
      canUpdateAssignedTasks: true,
      canManageCatalogs: true,
      canViewGlobalDashboard: true,
      canViewSearch: true,
      canViewStatistics: true,
      canViewResponsibleBoard: true,
      canViewHistory: true,
      navItems: navItemsForRole(roleCode),
    }
  }

  if (roleCode === 'supervisor') {
    return {
      roleCode,
      landingPath: getLandingPathForRole(roleCode),
      dashboardTitle: 'Dashboard de seguimiento',
      dashboardSubtitle: 'Indicadores del alcance operativo que supervisas y tareas que requieren atencion.',
      agendaTitle: 'Agenda de seguimiento',
      agendaSubtitle: 'Coordina tareas, revisa vencimientos y acompana el avance operativo del equipo.',
      canCreateTasks: true,
      canEditTasks: true,
      canDeleteTasks: false,
      canUpdateAssignedTasks: true,
      canManageCatalogs: false,
      canViewGlobalDashboard: false,
      canViewSearch: true,
      canViewStatistics: true,
      canViewResponsibleBoard: true,
      canViewHistory: true,
      navItems: navItemsForRole(roleCode),
    }
  }

  if (roleCode === 'responsable') {
    return {
      roleCode,
      landingPath: getLandingPathForRole(roleCode),
      dashboardTitle: 'Mis indicadores',
      dashboardSubtitle: 'Resumen de tus tareas asignadas, vencimientos y avance personal.',
      agendaTitle: 'Mis tareas asignadas',
      agendaSubtitle: 'Consulta tus prioridades, actualiza avances desde el historial y mantén tus entregas al dia.',
      canCreateTasks: false,
      canEditTasks: false,
      canDeleteTasks: false,
      canUpdateAssignedTasks: true,
      canManageCatalogs: false,
      canViewGlobalDashboard: false,
      canViewSearch: false,
      canViewStatistics: false,
      canViewResponsibleBoard: false,
      canViewHistory: true,
      navItems: navItemsForRole(roleCode),
    }
  }

  return {
    roleCode,
    landingPath: getLandingPathForRole(roleCode),
    dashboardTitle: 'Panel de consulta',
    dashboardSubtitle: 'Vista de solo lectura con la informacion permitida para tu perfil.',
    agendaTitle: 'Agenda en modo consulta',
    agendaSubtitle: 'Consulta tareas y vencimientos disponibles para tu perfil sin acciones de edicion.',
    canCreateTasks: false,
    canEditTasks: false,
    canDeleteTasks: false,
    canUpdateAssignedTasks: false,
    canManageCatalogs: false,
    canViewGlobalDashboard: false,
    canViewSearch: true,
    canViewStatistics: true,
    canViewResponsibleBoard: false,
    canViewHistory: false,
    navItems: navItemsForRole(roleCode),
  }
}

export function getRoleCapabilities(profile?: PerfilUsuario | null): RoleCapabilitySet {
  return getRoleCapabilitiesForCode(normalizarRoleCode(profile))
}
