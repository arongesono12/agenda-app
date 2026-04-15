-- ============================================================
-- MIGRACION: endurecimiento de seguridad y permisos por rol
-- Ejecutar despues de migration_user_profiles.sql
-- ============================================================

CREATE OR REPLACE FUNCTION current_role_code()
RETURNS TEXT AS $$
  SELECT LOWER(tu.codigo)
  FROM perfiles_usuario pu
  JOIN tipos_usuario tu ON tu.id = pu.tipo_usuario_id
  WHERE pu.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_any_role(allowed_codes TEXT[])
RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_role_code() = ANY (allowed_codes), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Authenticated access tareas" ON tareas;
DROP POLICY IF EXISTS "Authenticated access departamentos" ON departamentos;
DROP POLICY IF EXISTS "Authenticated access responsables" ON responsables;
DROP POLICY IF EXISTS "Authenticated access historial" ON historial;
DROP POLICY IF EXISTS "Authenticated access alertas" ON alertas;

CREATE POLICY "Read tareas by authorized roles"
ON tareas
FOR SELECT
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable', 'consulta']));

CREATE POLICY "Write tareas by editor roles"
ON tareas
FOR INSERT
TO authenticated
WITH CHECK (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']));

CREATE POLICY "Update tareas by editor roles"
ON tareas
FOR UPDATE
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']))
WITH CHECK (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']));

CREATE POLICY "Delete tareas by editor roles"
ON tareas
FOR DELETE
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']));

CREATE POLICY "Read departamentos by authorized roles"
ON departamentos
FOR SELECT
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable', 'consulta']));

CREATE POLICY "Manage departamentos by admin roles"
ON departamentos
FOR ALL
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora']))
WITH CHECK (has_any_role(ARRAY['administrador', 'administradora']));

CREATE POLICY "Read responsables by authorized roles"
ON responsables
FOR SELECT
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable', 'consulta']));

CREATE POLICY "Manage responsables by admin roles"
ON responsables
FOR ALL
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora']))
WITH CHECK (has_any_role(ARRAY['administrador', 'administradora']));

CREATE POLICY "Read historial by authorized roles"
ON historial
FOR SELECT
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable', 'consulta']));

CREATE POLICY "Insert historial by editor roles"
ON historial
FOR INSERT
TO authenticated
WITH CHECK (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']));

CREATE POLICY "Read alertas by authorized roles"
ON alertas
FOR SELECT
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable', 'consulta']));

CREATE POLICY "Manage alertas by editor roles"
ON alertas
FOR ALL
TO authenticated
USING (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']))
WITH CHECK (has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable']));
