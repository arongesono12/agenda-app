-- =============================================================================
-- FIX: evita "42P17 infinite recursion detected in policy for relation
-- organismo_miembros"
--
-- Ejecutar una vez en Supabase SQL Editor. Es idempotente.
-- =============================================================================

BEGIN;

-- Las policies antiguas consultaban public.organismo_miembros desde policies
-- de public.organismo_miembros. Eso provoca recursion RLS. Estas funciones
-- SECURITY DEFINER hacen la comprobacion de membresia/admin sin reentrar en
-- la misma policy.
CREATE OR REPLACE FUNCTION public.es_miembro_organismo(p_organismo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organismo_miembros om
    WHERE om.organismo_id = p_organismo_id
      AND om.usuario_id = auth.uid()
      AND om.activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.es_admin_organismo(p_organismo_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organismo_miembros om
    WHERE om.organismo_id = p_organismo_id
      AND om.usuario_id = auth.uid()
      AND om.rol_codigo IN ('administrador', 'administradora')
      AND om.activo = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.es_miembro_organismo(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_organismo(UUID) TO authenticated;

DROP POLICY IF EXISTS "organismos_miembros_pueden_ver" ON public.organismos;
DROP POLICY IF EXISTS "miembros_visibles_en_organismo" ON public.organismo_miembros;
DROP POLICY IF EXISTS "solo_admin_gestiona_miembros_insert" ON public.organismo_miembros;
DROP POLICY IF EXISTS "aislamiento_por_organismo_tareas" ON public.tareas;
DROP POLICY IF EXISTS "aislamiento_por_organismo_responsables" ON public.responsables;
DROP POLICY IF EXISTS "aislamiento_por_organismo_departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "aislamiento_por_organismo_historial" ON public.historial;
DROP POLICY IF EXISTS "suscripciones_visibles" ON public.organismo_suscripciones;
DROP POLICY IF EXISTS "facturas_visibles" ON public.organismo_facturas;
DROP POLICY IF EXISTS "invitaciones_visibles" ON public.organismo_invitaciones;

CREATE POLICY "organismos_miembros_pueden_ver" ON public.organismos
  FOR SELECT
  USING (public.es_miembro_organismo(id));

CREATE POLICY "miembros_visibles_en_organismo" ON public.organismo_miembros
  FOR SELECT
  USING (public.es_miembro_organismo(organismo_id));

CREATE POLICY "solo_admin_gestiona_miembros_insert" ON public.organismo_miembros
  FOR INSERT
  WITH CHECK (public.es_admin_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_tareas" ON public.tareas
  FOR ALL
  USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_responsables" ON public.responsables
  FOR ALL
  USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_departamentos" ON public.departamentos
  FOR ALL
  USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_historial" ON public.historial
  FOR ALL
  USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "suscripciones_visibles" ON public.organismo_suscripciones
  FOR SELECT
  USING (public.es_miembro_organismo(organismo_id));

CREATE POLICY "facturas_visibles" ON public.organismo_facturas
  FOR SELECT
  USING (public.es_miembro_organismo(organismo_id));

CREATE POLICY "invitaciones_visibles" ON public.organismo_invitaciones
  FOR SELECT
  USING (public.es_miembro_organismo(organismo_id));

COMMIT;
