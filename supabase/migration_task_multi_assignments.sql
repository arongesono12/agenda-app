-- Multi-asignacion de tareas
-- Ejecutar en Supabase SQL Editor despues de desplegar el codigo.

CREATE TABLE IF NOT EXISTS public.tarea_asignaciones (
  id BIGSERIAL PRIMARY KEY,
  tarea_id BIGINT NOT NULL REFERENCES public.tareas(id) ON DELETE CASCADE,
  responsable_id INTEGER REFERENCES public.responsables(id) ON DELETE SET NULL,
  responsable_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE,
  responsable_nombre TEXT NOT NULL,
  responsable_email TEXT,
  departamento TEXT,
  rol_codigo TEXT,
  asignado_por_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL,
  asignado_por_nombre TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarea_asignaciones_tarea_id
  ON public.tarea_asignaciones(tarea_id);

CREATE INDEX IF NOT EXISTS idx_tarea_asignaciones_usuario_activo
  ON public.tarea_asignaciones(responsable_usuario_id, activo);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tarea_asignaciones_tarea_usuario_activo
  ON public.tarea_asignaciones(tarea_id, responsable_usuario_id)
  WHERE activo = TRUE AND responsable_usuario_id IS NOT NULL;

INSERT INTO public.tarea_asignaciones (
  tarea_id,
  responsable_id,
  responsable_usuario_id,
  responsable_nombre,
  responsable_email,
  departamento,
  rol_codigo,
  asignado_por_usuario_id,
  asignado_por_nombre
)
SELECT
  t.id,
  COALESCE(t.responsable_id, r.id),
  COALESCE(t.responsable_usuario_id, r.usuario_id),
  COALESCE(r.nombre, NULLIF(TRIM(t.responsable), ''), 'Responsable'),
  LOWER(TRIM(r.email)),
  COALESCE(r.departamento, t.departamento),
  LOWER(TRIM(tu.codigo)),
  t.asignado_por_usuario_id,
  t.asignado_por_nombre
FROM public.tareas t
LEFT JOIN public.responsables r
  ON r.id = t.responsable_id
  OR (
    t.responsable_id IS NULL
    AND t.responsable IS NOT NULL
    AND LOWER(TRIM(r.nombre)) = LOWER(TRIM(t.responsable))
  )
LEFT JOIN public.perfiles_usuario pu
  ON pu.id = COALESCE(t.responsable_usuario_id, r.usuario_id)
LEFT JOIN public.tipos_usuario tu
  ON tu.id = pu.tipo_usuario_id
WHERE COALESCE(t.responsable_usuario_id, r.usuario_id) IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.tarea_asignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarea_asignaciones_select" ON public.tarea_asignaciones;
CREATE POLICY "tarea_asignaciones_select"
  ON public.tarea_asignaciones
  FOR SELECT
  USING (
    public.has_any_role(ARRAY['administrador', 'administradora'])
    OR responsable_usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.tareas t
      WHERE t.id = tarea_id
        AND public.can_read_tarea(t.responsable_usuario_id, t.departamento)
    )
  );

DROP POLICY IF EXISTS "tarea_asignaciones_insert_admin" ON public.tarea_asignaciones;
CREATE POLICY "tarea_asignaciones_insert_admin"
  ON public.tarea_asignaciones
  FOR INSERT
  WITH CHECK (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));

DROP POLICY IF EXISTS "tarea_asignaciones_update_admin" ON public.tarea_asignaciones;
CREATE POLICY "tarea_asignaciones_update_admin"
  ON public.tarea_asignaciones
  FOR UPDATE
  USING (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']))
  WITH CHECK (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));

DROP POLICY IF EXISTS "tarea_asignaciones_delete_admin" ON public.tarea_asignaciones;
CREATE POLICY "tarea_asignaciones_delete_admin"
  ON public.tarea_asignaciones
  FOR DELETE
  USING (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));

CREATE OR REPLACE FUNCTION public.user_is_assigned_to_tarea(p_tarea_id BIGINT)
RETURNS BOOLEAN AS $user_is_assigned_to_tarea$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tarea_asignaciones ta
    WHERE ta.tarea_id = p_tarea_id
      AND ta.responsable_usuario_id = auth.uid()
      AND ta.activo = TRUE
  );
END;
$user_is_assigned_to_tarea$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
