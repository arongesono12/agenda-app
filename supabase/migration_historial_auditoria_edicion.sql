-- Auditoria y control de edicion/eliminacion para historial de tareas.

ALTER TABLE public.historial
  ADD COLUMN IF NOT EXISTS actor_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_rol_codigo TEXT,
  ADD COLUMN IF NOT EXISTS editado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS editado_por_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS eliminado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eliminado_por_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion TEXT;

CREATE INDEX IF NOT EXISTS idx_historial_actor_usuario_id
  ON public.historial(actor_usuario_id);

CREATE INDEX IF NOT EXISTS idx_historial_tarea_visible_fecha
  ON public.historial(tarea_id, eliminado_at, fecha DESC);
