-- ============================================================
-- MIGRACION: administrador asignador de tarea
-- Ejecutar despues de migration_role_key_improvements.sql.
--
-- Permite notificar al administrador o administradora que asigno
-- una tarea cuando el responsable la marca como finalizada.
-- ============================================================

SET search_path = public;

ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS asignado_por_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asignado_por_nombre TEXT;

CREATE INDEX IF NOT EXISTS idx_tareas_asignado_por_usuario_id
  ON public.tareas(asignado_por_usuario_id);

UPDATE public.tareas t
SET asignado_por_usuario_id = admin_profile.id,
    asignado_por_nombre = COALESCE(admin_profile.nombre_completo, admin_profile.email)
FROM (
  SELECT pu.id, pu.email, pu.nombre_completo
  FROM public.perfiles_usuario pu
  JOIN public.tipos_usuario tu ON tu.id = pu.tipo_usuario_id
  WHERE LOWER(tu.codigo) IN ('administrador', 'administradora')
  ORDER BY pu.created_at ASC NULLS LAST
  LIMIT 1
) admin_profile
WHERE t.asignado_por_usuario_id IS NULL;
