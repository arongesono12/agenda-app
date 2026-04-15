import type { PreferenciasUsuario } from '@/lib/types'

export const DEFAULT_USER_PREFERENCES: Required<PreferenciasUsuario> = {
  theme: 'light',
  mostrar_kpis_agenda: true,
  abrir_filtros_agenda: false,
}

export function normalizarPreferenciasUsuario(
  value?: PreferenciasUsuario | null
): Required<PreferenciasUsuario> {
  return {
    theme: value?.theme === 'dark' ? 'dark' : DEFAULT_USER_PREFERENCES.theme,
    mostrar_kpis_agenda:
      typeof value?.mostrar_kpis_agenda === 'boolean'
        ? value.mostrar_kpis_agenda
        : DEFAULT_USER_PREFERENCES.mostrar_kpis_agenda,
    abrir_filtros_agenda:
      typeof value?.abrir_filtros_agenda === 'boolean'
        ? value.abrir_filtros_agenda
        : DEFAULT_USER_PREFERENCES.abrir_filtros_agenda,
  }
}
