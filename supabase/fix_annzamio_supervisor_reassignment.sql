-- FIX: Annzamio como supervisora operativa de SEGESA y trazabilidad de reasignaciones.
-- Ejecutar en Supabase SQL Editor.
--
-- Causa que corrige:
--   El codigo usa el rol del organismo activo y el propietario de la asignacion
--   (asignado_por_usuario_id) para que un supervisor pueda seguir reasignando
--   tareas ya delegadas a responsables de su departamento.
--
-- Este script asegura que annzamio@segesa.gq:
--   1. tenga rol global supervisor,
--   2. sea miembro supervisor del organismo SEGESA,
--   3. tenga su fila de responsables vinculada al perfil,
--   4. conserve departamento Coordinación si no lo tenia,
--   5. herede asignado_por_usuario_id en asignaciones ya creadas por ella.

BEGIN;

WITH constants AS (
  SELECT
    '00000000-0000-0000-0000-000000000001'::UUID AS segesa_id,
    'annzamio@segesa.gq'::TEXT AS target_email,
    'Servicios Técnicos'::TEXT AS target_department
),
supervisor_role AS (
  SELECT id
  FROM public.tipos_usuario
  WHERE LOWER(codigo) = 'supervisor'
),
target_profile AS (
  UPDATE public.perfiles_usuario pu
  SET tipo_usuario_id = (SELECT id FROM supervisor_role)
  FROM constants c
  WHERE LOWER(TRIM(pu.email)) = c.target_email
  RETURNING pu.id, pu.email, pu.nombre_completo
),
target_member AS (
  INSERT INTO public.organismo_miembros (
    organismo_id,
    usuario_id,
    rol_codigo,
    activo
  )
  SELECT
    c.segesa_id,
    tp.id,
    'supervisor',
    TRUE
  FROM constants c
  CROSS JOIN target_profile tp
  ON CONFLICT (organismo_id, usuario_id)
  DO UPDATE SET
    rol_codigo = 'supervisor',
    activo = TRUE
  RETURNING usuario_id
),
target_responsable AS (
  UPDATE public.responsables r
  SET
    usuario_id = tp.id,
    nombre = COALESCE(NULLIF(TRIM(r.nombre), ''), tp.nombre_completo, split_part(tp.email, '@', 1)),
    email = LOWER(TRIM(tp.email)),
    departamento = COALESCE(NULLIF(TRIM(r.departamento), ''), (SELECT target_department FROM constants)),
    cargo = COALESCE(NULLIF(TRIM(r.cargo), ''), 'Supervisor'),
    activo = TRUE,
    organismo_id = COALESCE(r.organismo_id, (SELECT segesa_id FROM constants))
  FROM target_profile tp, constants c
  WHERE LOWER(TRIM(r.email)) = c.target_email
      OR r.usuario_id = tp.id
      OR LOWER(TRIM(r.nombre)) = LOWER('Angelina Nfumu Nzamio Obono')
  RETURNING r.id, r.usuario_id
)
UPDATE public.tarea_asignaciones ta
SET
  asignado_por_usuario_id = COALESCE(ta.asignado_por_usuario_id, t.asignado_por_usuario_id),
  asignado_por_nombre = COALESCE(ta.asignado_por_nombre, t.asignado_por_nombre)
FROM public.tareas t, target_profile tp
WHERE ta.tarea_id = t.id
  AND t.asignado_por_usuario_id = tp.id
  AND ta.asignado_por_usuario_id IS NULL;

COMMIT;

-- Comprobacion recomendada despues de ejecutar:
-- SELECT pu.id, pu.email, tu.codigo AS rol_global, om.rol_codigo AS rol_organismo, r.departamento, r.usuario_id
-- FROM public.perfiles_usuario pu
-- LEFT JOIN public.tipos_usuario tu ON tu.id = pu.tipo_usuario_id
-- LEFT JOIN public.organismo_miembros om
--   ON om.usuario_id = pu.id
--  AND om.organismo_id = '00000000-0000-0000-0000-000000000001'
-- LEFT JOIN public.responsables r ON r.usuario_id = pu.id
-- WHERE LOWER(TRIM(pu.email)) = 'annzamio@segesa.gq';
