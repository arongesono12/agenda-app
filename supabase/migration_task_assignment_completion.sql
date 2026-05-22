-- =============================================================================
-- MIGRACION: avance y finalizacion por responsable en tareas multi-asignadas
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.tarea_asignaciones
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN IF NOT EXISTS porcentaje_avance NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completado_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tarea_asignaciones_estado_check'
      AND conrelid = 'public.tarea_asignaciones'::regclass
  ) THEN
    ALTER TABLE public.tarea_asignaciones
      ADD CONSTRAINT tarea_asignaciones_estado_check
      CHECK (estado IN ('Pendiente', 'En Proceso', 'Completado', 'Cancelado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tarea_asignaciones_porcentaje_avance_check'
      AND conrelid = 'public.tarea_asignaciones'::regclass
  ) THEN
    ALTER TABLE public.tarea_asignaciones
      ADD CONSTRAINT tarea_asignaciones_porcentaje_avance_check
      CHECK (porcentaje_avance BETWEEN 0 AND 100);
  END IF;
END $$;

UPDATE public.tarea_asignaciones ta
SET
  estado = CASE
    WHEN t.estado = 'Completado' THEN 'Completado'
    WHEN COALESCE(t.porcentaje_avance, 0) > 0 THEN 'En Proceso'
    ELSE 'Pendiente'
  END,
  porcentaje_avance = COALESCE(t.porcentaje_avance, 0),
  completado_at = CASE WHEN t.estado = 'Completado' THEN COALESCE(t.updated_at, NOW()) ELSE ta.completado_at END
FROM public.tareas t
WHERE t.id = ta.tarea_id
  AND ta.activo = TRUE
  AND (
    ta.porcentaje_avance = 0
    OR ta.estado = 'Pendiente'
  );

CREATE INDEX IF NOT EXISTS idx_tarea_asignaciones_tarea_estado_activo
  ON public.tarea_asignaciones(tarea_id, estado, activo);
