import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date?: string | null): string {
  if (!date) return '-'
  try {
    return format(parseISO(date), 'dd MMM yyyy', { locale: es })
  } catch {
    return '-'
  }
}

export function formatDateShort(date?: string | null): string {
  if (!date) return '-'
  try {
    return format(parseISO(date), 'dd/MM/yy', { locale: es })
  } catch {
    return '-'
  }
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatPercent(val?: number | null): string {
  if (val === null || val === undefined) return '0%'
  return `${Math.round(val)}%`
}
