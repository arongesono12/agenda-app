'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '@/components/ToastProvider'
import { useUserSession } from '@/components/UserSessionProvider'

type AssignmentAlert = {
  id: number
  tarea_id: number | null
  tipo_alerta: string
  titulo: string
  mensaje: string
  leida: boolean
  created_at: string
}

type AlertsResponse = {
  ok?: boolean
  alertas?: AssignmentAlert[]
}

const SHOWN_ASSIGNMENT_ALERTS_KEY = 'agenda-shown-assignment-alerts'

function readShownIds() {
  if (typeof window === 'undefined') return new Set<number>()

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHOWN_ASSIGNMENT_ALERTS_KEY) ?? '[]')
    return new Set((Array.isArray(parsed) ? parsed : []).map(Number).filter(Number.isInteger))
  } catch {
    return new Set<number>()
  }
}

function persistShownIds(ids: Set<number>) {
  const next = Array.from(ids).slice(-80)
  window.localStorage.setItem(SHOWN_ASSIGNMENT_ALERTS_KEY, JSON.stringify(next))
}

export default function AssignmentAlertToaster() {
  const toast = useToast()
  const { user, loading } = useUserSession()
  const pollingRef = useRef(false)

  const checkAssignmentAlerts = useCallback(async () => {
    if (!user || pollingRef.current) return

    pollingRef.current = true

    try {
      const response = await fetch('/api/alertas?unread=true&limit=8', { cache: 'no-store' })
      const result = (await response.json()) as AlertsResponse
      if (!response.ok || !result.ok) return

      const shownIds = readShownIds()
      const assignmentAlerts = (result.alertas ?? [])
        .filter((alert) => alert.tipo_alerta === 'Asignada' && !shownIds.has(alert.id))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      for (const alert of assignmentAlerts) {
        shownIds.add(alert.id)
        toast.info(alert.mensaje || alert.titulo || 'Tienes una nueva tarea asignada.', 8000)
        window.dispatchEvent(new CustomEvent('agenda:task-assigned', { detail: { taskId: alert.tarea_id } }))
      }

      if (assignmentAlerts.length > 0) {
        persistShownIds(shownIds)
      }
    } catch {
      // No interrumpir la experiencia de la app por una comprobacion de alertas.
    } finally {
      pollingRef.current = false
    }
  }, [toast, user])

  useEffect(() => {
    if (loading || !user) return

    void checkAssignmentAlerts()
    const interval = window.setInterval(() => void checkAssignmentAlerts(), 30_000)

    const onFocus = () => void checkAssignmentAlerts()
    const onVisibilityChange = () => {
      if (!document.hidden) void checkAssignmentAlerts()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [checkAssignmentAlerts, loading, user])

  return null
}
