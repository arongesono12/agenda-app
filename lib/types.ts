export type Prioridad = 'Alta' | 'Media' | 'Baja'
export type Estado = 'Pendiente' | 'En Proceso' | 'Completado' | 'Cancelado'
export type TipoTarea = string
export type TipoOrden = 'Orden' | 'Nota' | 'Avance' | 'Cambio de Estado' | 'Incidencia' | 'Recordatorio'
export type Semaforo =
  '\u{1F534} Vencida' |
  '\u{1F7E0} Urgente' |
  '\u{1F7E1} Pr\u00F3xima' |
  '\u{1F7E2} A tiempo' |
  '\u26AA Sin fecha'

export interface Tarea {
  id: number
  codigo_id?: number | null
  tarea: string
  prioridad: Prioridad
  departamento?: string
  seccion?: string
  responsable_id?: number | null
  responsable_usuario_id?: string | null
  responsable?: string
  fecha_inicio?: string
  fecha_fin?: string
  dias_totales?: number
  porcentaje_avance: number
  dias_restantes?: number | null
  semaforo?: Semaforo
  estado: Estado
  tipo_tarea?: TipoTarea | null
  ultima_actualizacion?: string
  notas?: string
  created_at?: string
  updated_at?: string
}

export interface Historial {
  id: number
  fecha: string
  usuario: string
  tarea_id?: number
  tarea_nombre?: string
  modulo: string
  tipo_cambio: string
  valor_anterior?: string
  valor_nuevo?: string
  observaciones?: string
}

export interface StatsDepartamento {
  departamento: string
  total: number
  alta_prioridad: number
  en_proceso: number
  completadas: number
  pendientes: number
  avance_promedio: number
}

export interface KPIs {
  total: number
  pendientes: number
  en_proceso: number
  completadas: number
  alta_prioridad: number
  vencidas: number
  urgentes: number
  avance_promedio: number
}

export interface TipoUsuario {
  id: number
  codigo: string
  nombre: string
  descripcion?: string | null
  created_at?: string
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface PreferenciasUsuario {
  theme?: ThemePreference
  mostrar_kpis_agenda?: boolean
  abrir_filtros_agenda?: boolean
}

export interface PerfilUsuario {
  id: string
  email: string
  nombre_completo?: string | null
  avatar_url?: string | null
  preferencias?: PreferenciasUsuario | null
  tipo_usuario_id?: number | null
  created_at?: string
  updated_at?: string
  tipo_usuario?: TipoUsuario | null
}

export interface Responsable {
  id: number
  nombre: string
  email?: string | null
  usuario_id?: string | null
  departamento?: string | null
  cargo?: string | null
  activo: boolean
  created_at?: string
}

export const DEPARTAMENTOS = [
  'Gabinete', 'Coordinaci\u00F3n', 'Servicios T\u00E9cnicos', 'Servicios Comerciales',
  'Asesor\u00EDa Jur\u00EDdica', 'Servicios Financieros', 'RRHH',
  'Suministro y Log\u00EDstica', 'Servicios Inform\u00E1ticos', 'Consejeros', 'Asesores'
]

export const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']
export const ESTADOS: Estado[] = ['Pendiente', 'En Proceso', 'Completado', 'Cancelado']
export const TIPOS_TAREA: TipoTarea[] = ['Estrat\u00E9gica', 'T\u00E9cnica', 'Administrativa', 'Comercial', 'Operativa']
export const TIPOS_ORDEN: TipoOrden[] = ['Orden', 'Nota', 'Avance', 'Cambio de Estado', 'Incidencia', 'Recordatorio']

export const PRIORIDAD_COLORS: Record<Prioridad, string> = {
  Alta: 'bg-red-50 text-red-700 border-red-200',
  Media: 'bg-amber-50 text-amber-700 border-amber-200',
  Baja: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export const ESTADO_COLORS: Record<Estado, string> = {
  Pendiente: 'bg-slate-100 text-slate-600 border-slate-200',
  'En Proceso': 'bg-blue-50 text-blue-700 border-blue-200',
  Completado: 'bg-teal-50 text-teal-700 border-teal-200',
  Cancelado: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const TIPO_COLORS: Record<TipoTarea, string> = {
  'Estrat\u00E9gica': 'bg-purple-50 text-purple-700 border-purple-200',
  'T\u00E9cnica': 'bg-sky-50 text-sky-700 border-sky-200',
  Administrativa: 'bg-orange-50 text-orange-700 border-orange-200',
  Comercial: 'bg-pink-50 text-pink-700 border-pink-200',
  Operativa: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}
