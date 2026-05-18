-- Multi-asignacion de departamentos por tarea.
-- Mantiene tareas.departamento como departamento principal/legacy.

CREATE TABLE IF NOT EXISTS public.tarea_departamentos (
  id BIGSERIAL PRIMARY KEY,
  tarea_id BIGINT NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  departamento TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarea_departamentos_tarea_id
  ON public.tarea_departamentos(tarea_id);

CREATE INDEX IF NOT EXISTS idx_tarea_departamentos_departamento
  ON public.tarea_departamentos(departamento);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarea_departamentos_tarea_departamento
  ON public.tarea_departamentos(tarea_id, departamento);

INSERT INTO public.tarea_departamentos (tarea_id, departamento)
SELECT id, TRIM(departamento)
FROM public.tareas
WHERE NULLIF(TRIM(departamento), '') IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.tarea_departamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarea_departamentos_select" ON public.tarea_departamentos;
CREATE POLICY "tarea_departamentos_select"
  ON public.tarea_departamentos
  FOR SELECT
  USING (
    public.has_any_role(ARRAY['administrador', 'administradora'])
    OR EXISTS (
      SELECT 1
      FROM public.tareas t
      WHERE t.id = tarea_id
        AND public.can_read_tarea(t.responsable_usuario_id, t.departamento)
    )
    OR EXISTS (
      SELECT 1
      FROM public.tarea_asignaciones ta
      WHERE ta.tarea_id = tarea_departamentos.tarea_id
        AND ta.responsable_usuario_id = auth.uid()
        AND ta.activo = TRUE
    )
  );

DROP POLICY IF EXISTS "tarea_departamentos_insert_manager" ON public.tarea_departamentos;
CREATE POLICY "tarea_departamentos_insert_manager"
  ON public.tarea_departamentos
  FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));

DROP POLICY IF EXISTS "tarea_departamentos_update_manager" ON public.tarea_departamentos;
CREATE POLICY "tarea_departamentos_update_manager"
  ON public.tarea_departamentos
  FOR UPDATE
  USING (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']))
  WITH CHECK (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));

DROP POLICY IF EXISTS "tarea_departamentos_delete_manager" ON public.tarea_departamentos;
CREATE POLICY "tarea_departamentos_delete_manager"
  ON public.tarea_departamentos
  FOR DELETE
  USING (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));
