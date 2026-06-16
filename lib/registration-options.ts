export type RegistrationRole = {
  codigo: string
  nombre: string
  descripcion: string
}

export type RegistrationDepartamento = {
  id: number
  nombre: string
}

export const REGISTRATION_ROLES: RegistrationRole[] = [
  {
    codigo: 'administrador',
    nombre: 'Administrador',
    descripcion: 'Gestion completa del sistema, catalogos, seguimiento y configuracion operativa.',
  },
  {
    codigo: 'administradora',
    nombre: 'Administradora',
    descripcion: 'Gestion completa del sistema, catalogos, seguimiento y configuracion operativa.',
  },
  {
    codigo: 'supervisor',
    nombre: 'Supervisor',
    descripcion: 'Seguimiento ejecutivo del avance, control de alertas y consulta de indicadores.',
  },
  {
    codigo: 'responsable',
    nombre: 'Responsable',
    descripcion: 'Gestion de sus tareas, actualizacion de avances y consulta de historial.',
  },
  {
    codigo: 'consulta',
    nombre: 'Consulta',
    descripcion: 'Acceso de solo lectura a paneles, cronograma, alertas e historial.',
  },
]

export const PUBLIC_REGISTRATION_ROLES = REGISTRATION_ROLES.filter(
  (role) => role.codigo === 'supervisor' || role.codigo === 'responsable' || role.codigo === 'consulta'
)

export const REGISTRATION_DEPARTAMENTOS: RegistrationDepartamento[] = [
  { id: 1, nombre: 'Gabinete' },
  { id: 2, nombre: 'Coordinacion' },
  { id: 3, nombre: 'Servicios Tecnicos' },
  { id: 4, nombre: 'Servicios Comerciales' },
  { id: 5, nombre: 'Asesoria Juridica' },
  { id: 6, nombre: 'Servicios Financieros' },
  { id: 7, nombre: 'RRHH' },
  { id: 8, nombre: 'Suministro y Logistica' },
  { id: 9, nombre: 'Servicios Informaticos' },
  { id: 10, nombre: 'Consejeros' },
  { id: 11, nombre: 'Asesores' },
]

export const REGISTRATION_ROLE_CODES = REGISTRATION_ROLES.map((role) => role.codigo)
export const PUBLIC_REGISTRATION_ROLE_CODES = PUBLIC_REGISTRATION_ROLES.map((role) => role.codigo)
