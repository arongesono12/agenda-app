'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, PenTool, Video, X } from 'lucide-react'
import type { Reunion } from '@/lib/types'

type VideoSdkConfig = {
  videoSDKJWT: string
  sessionName: string
  sessionPasscode: string
  userName: string
}

type VideoSdkTokenResponse = {
  ok?: boolean
  config?: VideoSdkConfig
  error?: string
}

type ZoomVideoSdkMeetingProps = {
  reunion: Reunion
  onClose: () => void
}

export default function ZoomVideoSdkMeeting({ reunion, onClose }: ZoomVideoSdkMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const toolkitRef = useRef<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | null = null

    const startSession = async () => {
      try {
        setLoading(true)
        setError('')

        const response = await fetch('/api/reuniones/videosdk-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reunionId: reunion.id }),
        })
        const result = (await response.json()) as VideoSdkTokenResponse
        if (!response.ok || !result.ok || !result.config) {
          throw new Error(result.error ?? 'No se pudo preparar la sala de video.')
        }

        const toolkitModule = await import('@zoom/videosdk-ui-toolkit')
        const uitoolkit = toolkitModule.default
        toolkitRef.current = uitoolkit

        if (cancelled || !containerRef.current) return

        const sessionClosed = () => {
          try {
            uitoolkit.destroy()
          } finally {
            if (!cancelled) onClose()
          }
        }
        const sessionDestroyed = () => {
          try {
            uitoolkit.destroy()
          } finally {
            if (!cancelled) onClose()
          }
        }

        const sessionConfig = {
          videoSDKJWT: result.config.videoSDKJWT,
          sessionName: result.config.sessionName,
          userName: result.config.userName,
          sessionPasscode: result.config.sessionPasscode,
          language: 'es-ES',
          sessionIdleTimeoutMins: 120,
          leaveOnPageUnload: true,
          featuresOptions: {
            preview: { enable: true },
            video: { enable: true },
            audio: { enable: true },
            share: { enable: true },
            chat: { enable: true, enableEmoji: true },
            users: { enable: true },
            settings: { enable: true },
            invite: { enable: false },
            theme: { enable: true, defaultTheme: 'light' as const },
            feedback: { enable: false },
            leave: { enable: true },
            header: { enable: true },
            footer: { enable: true },
            virtualBackground: { enable: true },
            whiteboard: {
              enable: true,
              enableExport: true,
              enableViewerUserExport: true,
            },
          },
        }

        await uitoolkit.joinSession(containerRef.current, sessionConfig)

        uitoolkit.onSessionClosed(sessionClosed)
        uitoolkit.onSessionDestroyed(sessionDestroyed)
        cleanup = () => {
          uitoolkit.offSessionClosed(sessionClosed)
          uitoolkit.offSessionDestroyed(sessionDestroyed)
          try {
            uitoolkit.destroy()
          } catch {
            // The toolkit may already be destroyed by Zoom's own lifecycle.
          }
        }
      } catch (startError: unknown) {
        if (!cancelled) {
          setError(startError instanceof Error ? startError.message : 'No se pudo iniciar la sala de video.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void startSession()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [onClose, reunion.id])

  const closeSession = async () => {
    const toolkit = toolkitRef.current as { closeSession?: (container: HTMLElement) => Promise<unknown>; destroy?: () => void } | null
    try {
      if (toolkit?.closeSession && containerRef.current) {
        await toolkit.closeSession(containerRef.current)
      }
      toolkit?.destroy?.()
    } finally {
      onClose()
    }
  }

  return (
    <div className="agenda-modal-overlay">
      <div className="agenda-modal-shell agenda-modal-shell-xl flex h-[94dvh] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-white/70 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
              <Video size={15} />
              Zoom Video SDK
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">{reunion.titulo}</h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <PenTool size={13} className="text-teal-600" />
              Pizarra activa para presentar, planificar y colaborar durante la reunion.
            </p>
          </div>
          <button type="button" onClick={() => void closeSession()} className="agenda-modal-close" aria-label="Cerrar sala de video">
            <X size={16} />
          </button>
        </div>

        {error ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-center">
              <p className="text-sm font-semibold text-rose-700">No se pudo iniciar la reunion en la app</p>
              <p className="mt-2 text-sm leading-6 text-rose-600">{error}</p>
            </div>
          </div>
        ) : (
          <div className="relative min-h-0 flex-1 bg-slate-950">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 text-white">
                <div className="text-center">
                  <Loader2 size={26} className="mx-auto animate-spin text-teal-300" />
                  <p className="mt-3 text-sm font-semibold">Preparando sala de video...</p>
                </div>
              </div>
            )}
            <div ref={containerRef} className="h-full min-h-[520px] w-full" />
          </div>
        )}
      </div>
    </div>
  )
}
