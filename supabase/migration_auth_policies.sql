-- ============================================================
-- MIGRACION: endurecer acceso a datos de la agenda
-- Ejecutar en Supabase SQL Editor
-- ============================================================

ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsables ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access tareas" ON tareas;
DROP POLICY IF EXISTS "Public access departamentos" ON departamentos;
DROP POLICY IF EXISTS "Public access responsables" ON responsables;
DROP POLICY IF EXISTS "Public access historial" ON historial;
DROP POLICY IF EXISTS "Public access alertas" ON alertas;

DROP POLICY IF EXISTS "Authenticated access tareas" ON tareas;
DROP POLICY IF EXISTS "Authenticated access departamentos" ON departamentos;
DROP POLICY IF EXISTS "Authenticated access responsables" ON responsables;
DROP POLICY IF EXISTS "Authenticated access historial" ON historial;
DROP POLICY IF EXISTS "Authenticated access alertas" ON alertas;

CREATE POLICY "Authenticated access tareas"
ON tareas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated access departamentos"
ON departamentos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated access responsables"
ON responsables
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated access historial"
ON historial
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated access alertas"
ON alertas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
