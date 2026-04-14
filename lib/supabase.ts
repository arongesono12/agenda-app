import { createBrowserClient } from '@supabase/ssr'
import type { Semaforo, Tarea } from '@/lib/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export const SEMAFORO_SIN_FECHA = '\u26AA Sin fecha'
export const SEMAFORO_VENCIDA = '\u{1F534} Vencida'
export const SEMAFORO_URGENTE = '\u{1F7E0} Urgente'
export const SEMAFORO_PROXIMA = '\u{1F7E1} Pr\u00F3xima'
export const SEMAFORO_A_TIEMPO = '\u{1F7E2} A tiempo'

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function calcularSemaforo(fecha_fin?: string): Semaforo {
  if (!fecha_fin) return SEMAFORO_SIN_FECHA

  const today = startOfToday()
  const fin = parseDateOnly(fecha_fin)
  const diff = Math.ceil((fin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return SEMAFORO_VENCIDA
  if (diff <= 2) return SEMAFORO_URGENTE
  if (diff <= 5) return SEMAFORO_PROXIMA
  return SEMAFORO_A_TIEMPO
}

export function calcularDiasRestantes(fecha_fin?: string): number | null {
  if (!fecha_fin) return null

  const today = startOfToday()
  const fin = parseDateOnly(fecha_fin)
  return Math.ceil((fin.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function normalizarTarea<T extends Pick<Tarea, 'fecha_fin'>>(task: T): T & Pick<Tarea, 'dias_restantes' | 'semaforo'> {
  return {
    ...task,
    dias_restantes: calcularDiasRestantes(task.fecha_fin),
    semaforo: calcularSemaforo(task.fecha_fin),
  }
}

export function normalizarTareas<T extends Pick<Tarea, 'fecha_fin'>>(tasks?: T[] | null): Array<T & Pick<Tarea, 'dias_restantes' | 'semaforo'>> {
  return (tasks ?? []).map(normalizarTarea)
}
