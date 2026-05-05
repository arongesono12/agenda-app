-- ============================================================
-- MIGRACION: mejoras clave por rol, asignacion y backend seguro
-- Ejecutar despues de schema.sql y de las migraciones de perfiles.
--
-- Cubre:
-- 1. Roles operativos consistentes.
-- 2. Responsables vinculados a usuarios.
-- 3. Tareas asignables por usuario real.
-- 4. Alertas internas por destinatario.
-- 5. Historial consultable por alcance.
-- 6. RLS alineado con la UI y las APIs del backend.
-- ============================================================

SET search_path = public;

-- ------------------------------------------------------------
-- Roles y perfiles
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tipos_usuario (
  id SMALLSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.tipos_usuario (codigo, nombre, descripcion)
VALUES
  ('administrador', 'Administrador', 'Gestion completa del sistema.'),
  ('administradora', 'Administradora', 'Gestion completa del sistema.'),
  ('supervisor', 'Supervisor', 'Seguimiento operativo y gestion de tareas sin eliminacion.'),
  ('responsable', 'Responsable', 'Consulta y actualiza avances de tareas asignadas.'),
  ('consulta', 'Consulta', 'Acceso de solo lectura a las vistas permitidas.')
ON CONFLICT (codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

CREATE OR REPLACE FUNCTION public.resolve_default_tipo_usuario_id()
RETURNS SMALLINT AS $resolve_default_tipo_usuario_id$
DECLARE
  default_id SMALLINT;
BEGIN
  SELECT id INTO default_id
  FROM public.tipos_usuario
  WHERE codigo = 'responsable'
  LIMIT 1;

  RETURN default_id;
END;
$resolve_default_tipo_usuario_id$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE TABLE IF NOT EXISTS public.perfiles_usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre_completo TEXT,
  tipo_usuario_id SMALLINT REFERENCES public.tipos_usuario(id) DEFAULT public.resolve_default_tipo_usuario_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.perfiles_usuario
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS preferencias JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_tipo_usuario_id
  ON public.perfiles_usuario(tipo_usuario_id);

CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_email_lower
  ON public.perfiles_usuario(LOWER(email));

-- ------------------------------------------------------------
-- Catalogos base
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.departamentos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.responsables (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  departamento TEXT,
  cargo TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.responsables
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_responsables_email_unique
  ON public.responsables(LOWER(email))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE INDEX IF NOT EXISTS idx_responsables_usuario_id
  ON public.responsables(usuario_id);

CREATE INDEX IF NOT EXISTS idx_responsables_usuario_departamento
  ON public.responsables(usuario_id, departamento)
  WHERE activo = true;

-- ------------------------------------------------------------
-- Tareas, historial y alertas
-- ------------------------------------------------------------

ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS responsable_id INTEGER REFERENCES public.responsables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL;

ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS destinatario_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS destinatario_email TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS mensaje TEXT,
  ADD COLUMN IF NOT EXISTS enviada_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS alerta_key TEXT;

ALTER TABLE public.historial
  ADD COLUMN IF NOT EXISTS actor_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_responsable_id
  ON public.tareas(responsable_id);

CREATE INDEX IF NOT EXISTS idx_tareas_responsable_usuario_id
  ON public.tareas(responsable_usuario_id);

CREATE INDEX IF NOT EXISTS idx_tareas_scope_responsable_estado_fecha
  ON public.tareas(responsable_usuario_id, estado, fecha_fin DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_departamento_estado_fecha
  ON public.tareas(departamento, estado, fecha_fin DESC);

CREATE INDEX IF NOT EXISTS idx_historial_tarea_fecha
  ON public.historial(tarea_id, fecha DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_alerta_key_unique
  ON public.alertas(alerta_key)
  WHERE alerta_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alertas_destinatario_leida_created
  ON public.alertas(destinatario_usuario_id, leida, created_at DESC);

-- ------------------------------------------------------------
-- Sincronizacion de responsables y tareas
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_responsable_usuario_id()
RETURNS TRIGGER AS $sync_responsable_usuario_id$
DECLARE
  perfil_id UUID;
BEGIN
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    NEW.usuario_id = NULL;
    RETURN NEW;
  END IF;

  NEW.email = LOWER(TRIM(NEW.email));

  SELECT id INTO perfil_id
  FROM public.perfiles_usuario
  WHERE LOWER(email) = NEW.email
  LIMIT 1;

  NEW.usuario_id = perfil_id;
  RETURN NEW;
END;
$sync_responsable_usuario_id$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS responsables_sync_usuario_id ON public.responsables;
CREATE TRIGGER responsables_sync_usuario_id
  BEFORE INSERT OR UPDATE OF email
  ON public.responsables
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_responsable_usuario_id();

CREATE OR REPLACE FUNCTION public.sync_tarea_responsable_usuario_id()
RETURNS TRIGGER AS $sync_tarea_responsable_usuario_id$
DECLARE
  responsable_row public.responsables%ROWTYPE;
BEGIN
  IF NEW.responsable_id IS NOT NULL THEN
    SELECT * INTO responsable_row
    FROM public.responsables
    WHERE id = NEW.responsable_id
    LIMIT 1;
  ELSIF NEW.responsable IS NOT NULL AND TRIM(NEW.responsable) <> '' THEN
    SELECT * INTO responsable_row
    FROM public.responsables
    WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(NEW.responsable))
    LIMIT 1;
  END IF;

  IF responsable_row.id IS NOT NULL THEN
    NEW.responsable_id = responsable_row.id;
    NEW.responsable = responsable_row.nombre;
    NEW.responsable_usuario_id = responsable_row.usuario_id;
  END IF;

  RETURN NEW;
END;
$sync_tarea_responsable_usuario_id$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tareas_sync_responsable_usuario_id ON public.tareas;
CREATE TRIGGER tareas_sync_responsable_usuario_id
  BEFORE INSERT OR UPDATE OF responsable_id, responsable
  ON public.tareas
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tarea_responsable_usuario_id();

UPDATE public.responsables r
SET email = LOWER(TRIM(pu.email)),
    usuario_id = pu.id
FROM public.perfiles_usuario pu
WHERE r.usuario_id IS NULL
  AND LOWER(TRIM(r.nombre)) = LOWER(TRIM(COALESCE(pu.nombre_completo, split_part(pu.email, '@', 1))));

UPDATE public.tareas t
SET responsable_id = r.id,
    responsable_usuario_id = r.usuario_id,
    responsable = r.nombre
FROM public.responsables r
WHERE (t.responsable_id IS NULL OR t.responsable_usuario_id IS NULL)
  AND t.responsable IS NOT NULL
  AND LOWER(TRIM(t.responsable)) = LOWER(TRIM(r.nombre));

-- ------------------------------------------------------------
-- Helpers de seguridad por rol
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS TEXT AS $current_role_code$
  SELECT LOWER(tu.codigo)
  FROM public.perfiles_usuario pu
  JOIN public.tipos_usuario tu ON tu.id = pu.tipo_usuario_id
  WHERE pu.id = auth.uid()
  LIMIT 1;
$current_role_code$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_any_role(allowed_codes TEXT[])
RETURNS BOOLEAN AS $has_any_role$
  SELECT COALESCE(public.current_role_code() = ANY (allowed_codes), false);
$has_any_role$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_departamentos()
RETURNS TEXT[] AS $current_user_departamentos$
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT TRIM(r.departamento)) FILTER (
      WHERE r.departamento IS NOT NULL AND TRIM(r.departamento) <> ''
    ),
    ARRAY[]::TEXT[]
  )
  FROM public.responsables r
  WHERE r.usuario_id = auth.uid()
    AND COALESCE(r.activo, true) = true;
$current_user_departamentos$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_read_tarea(
  p_responsable_usuario_id UUID,
  p_departamento TEXT
)
RETURNS BOOLEAN AS $can_read_tarea$
DECLARE
  role_code TEXT;
  departamentos TEXT[];
BEGIN
  role_code := public.current_role_code();

  IF role_code IN ('administrador', 'administradora') THEN
    RETURN true;
  END IF;

  IF role_code = 'supervisor' THEN
    departamentos := public.current_user_departamentos();
    RETURN p_responsable_usuario_id = auth.uid()
      OR CARDINALITY(departamentos) = 0
      OR TRIM(COALESCE(p_departamento, '')) = ANY (departamentos);
  END IF;

  IF role_code = 'responsable' THEN
    RETURN p_responsable_usuario_id = auth.uid();
  END IF;

  IF role_code = 'consulta' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$can_read_tarea$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_create_or_update_tarea(
  p_responsable_usuario_id UUID,
  p_departamento TEXT
)
RETURNS BOOLEAN AS $can_create_or_update_tarea$
DECLARE
  role_code TEXT;
  departamentos TEXT[];
BEGIN
  role_code := public.current_role_code();

  IF role_code IN ('administrador', 'administradora') THEN
    RETURN true;
  END IF;

  IF role_code = 'supervisor' THEN
    departamentos := public.current_user_departamentos();
    RETURN p_responsable_usuario_id = auth.uid()
      OR CARDINALITY(departamentos) = 0
      OR TRIM(COALESCE(p_departamento, '')) = ANY (departamentos);
  END IF;

  RETURN false;
END;
$can_create_or_update_tarea$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_delete_tarea()
RETURNS BOOLEAN AS $can_delete_tarea$
  SELECT public.has_any_role(ARRAY['administrador', 'administradora']);
$can_delete_tarea$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_insert_historial_tarea(
  p_responsable_usuario_id UUID,
  p_departamento TEXT
)
RETURNS BOOLEAN AS $can_insert_historial_tarea$
DECLARE
  role_code TEXT;
BEGIN
  role_code := public.current_role_code();

  IF role_code IN ('administrador', 'administradora', 'supervisor') THEN
    RETURN public.can_create_or_update_tarea(p_responsable_usuario_id, p_departamento);
  END IF;

  IF role_code = 'responsable' THEN
    RETURN p_responsable_usuario_id = auth.uid();
  END IF;

  RETURN false;
END;
$can_insert_historial_tarea$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- RLS: politicas alineadas con frontend y APIs
-- ------------------------------------------------------------

ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read tareas by authorized roles" ON public.tareas;
DROP POLICY IF EXISTS "Write tareas by editor roles" ON public.tareas;
DROP POLICY IF EXISTS "Update tareas by editor roles" ON public.tareas;
DROP POLICY IF EXISTS "Delete tareas by editor roles" ON public.tareas;
DROP POLICY IF EXISTS "Scoped read tareas" ON public.tareas;
DROP POLICY IF EXISTS "Scoped insert tareas" ON public.tareas;
DROP POLICY IF EXISTS "Scoped update tareas" ON public.tareas;
DROP POLICY IF EXISTS "Scoped delete tareas" ON public.tareas;

CREATE POLICY "Scoped read tareas"
ON public.tareas
FOR SELECT
TO authenticated
USING (public.can_read_tarea(responsable_usuario_id, departamento));

CREATE POLICY "Scoped insert tareas"
ON public.tareas
FOR INSERT
TO authenticated
WITH CHECK (public.can_create_or_update_tarea(responsable_usuario_id, departamento));

CREATE POLICY "Scoped update tareas"
ON public.tareas
FOR UPDATE
TO authenticated
USING (public.can_create_or_update_tarea(responsable_usuario_id, departamento))
WITH CHECK (public.can_create_or_update_tarea(responsable_usuario_id, departamento));

CREATE POLICY "Scoped delete tareas"
ON public.tareas
FOR DELETE
TO authenticated
USING (public.can_delete_tarea());

DROP POLICY IF EXISTS "Read historial by authorized roles" ON public.historial;
DROP POLICY IF EXISTS "Insert historial by editor roles" ON public.historial;
DROP POLICY IF EXISTS "Scoped read historial" ON public.historial;
DROP POLICY IF EXISTS "Scoped insert historial" ON public.historial;

CREATE POLICY "Scoped read historial"
ON public.historial
FOR SELECT
TO authenticated
USING (
  tarea_id IS NULL
  OR EXISTS (
    SELECT 1
    FROM public.tareas t
    WHERE t.id = historial.tarea_id
      AND public.can_read_tarea(t.responsable_usuario_id, t.departamento)
  )
);

CREATE POLICY "Scoped insert historial"
ON public.historial
FOR INSERT
TO authenticated
WITH CHECK (
  tarea_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.tareas t
    WHERE t.id = historial.tarea_id
      AND public.can_insert_historial_tarea(t.responsable_usuario_id, t.departamento)
  )
);

DROP POLICY IF EXISTS "Read alertas by authorized roles" ON public.alertas;
DROP POLICY IF EXISTS "Manage alertas by editor roles" ON public.alertas;
DROP POLICY IF EXISTS "Scoped read own alertas" ON public.alertas;
DROP POLICY IF EXISTS "Scoped update own alertas" ON public.alertas;

CREATE POLICY "Scoped read own alertas"
ON public.alertas
FOR SELECT
TO authenticated
USING (
  destinatario_usuario_id = auth.uid()
  OR public.has_any_role(ARRAY['administrador', 'administradora'])
);

CREATE POLICY "Scoped update own alertas"
ON public.alertas
FOR UPDATE
TO authenticated
USING (
  destinatario_usuario_id = auth.uid()
  OR public.has_any_role(ARRAY['administrador', 'administradora'])
)
WITH CHECK (
  destinatario_usuario_id = auth.uid()
  OR public.has_any_role(ARRAY['administrador', 'administradora'])
);

DROP POLICY IF EXISTS "Read departamentos by authorized roles" ON public.departamentos;
DROP POLICY IF EXISTS "Manage departamentos by admin roles" ON public.departamentos;

CREATE POLICY "Read departamentos by authorized roles"
ON public.departamentos
FOR SELECT
TO authenticated
USING (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor', 'responsable', 'consulta']));

CREATE POLICY "Manage departamentos by admin roles"
ON public.departamentos
FOR ALL
TO authenticated
USING (public.has_any_role(ARRAY['administrador', 'administradora']))
WITH CHECK (public.has_any_role(ARRAY['administrador', 'administradora']));

DROP POLICY IF EXISTS "Read responsables by authorized roles" ON public.responsables;
DROP POLICY IF EXISTS "Manage responsables by admin roles" ON public.responsables;
DROP POLICY IF EXISTS "Read responsables by manager roles" ON public.responsables;

CREATE POLICY "Read responsables by manager roles"
ON public.responsables
FOR SELECT
TO authenticated
USING (public.has_any_role(ARRAY['administrador', 'administradora', 'supervisor']));

CREATE POLICY "Manage responsables by admin roles"
ON public.responsables
FOR ALL
TO authenticated
USING (public.has_any_role(ARRAY['administrador', 'administradora']))
WITH CHECK (public.has_any_role(ARRAY['administrador', 'administradora']));

DROP POLICY IF EXISTS "Read own profile" ON public.perfiles_usuario;
DROP POLICY IF EXISTS "Update own profile" ON public.perfiles_usuario;
DROP POLICY IF EXISTS "Admins read profiles" ON public.perfiles_usuario;

CREATE POLICY "Read own profile"
ON public.perfiles_usuario
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_any_role(ARRAY['administrador', 'administradora']));

CREATE POLICY "Update own profile"
ON public.perfiles_usuario
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins read profiles"
ON public.perfiles_usuario
FOR SELECT
TO authenticated
USING (public.has_any_role(ARRAY['administrador', 'administradora']));

DROP POLICY IF EXISTS "Read tipos usuario by authenticated" ON public.tipos_usuario;
CREATE POLICY "Read tipos usuario by authenticated"
ON public.tipos_usuario
FOR SELECT
TO authenticated
USING (true);

GRANT EXECUTE ON FUNCTION public.current_role_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_departamentos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_tarea(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_or_update_tarea(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_tarea() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_insert_historial_tarea(UUID, TEXT) TO authenticated;
