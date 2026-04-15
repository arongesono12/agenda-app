-- ============================================================
-- MIGRACION: perfiles de usuario y tipos de usuario
-- Ejecutar despues de schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS tipos_usuario (
  id SMALLSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tipos_usuario (codigo, nombre, descripcion)
VALUES
  ('administrador', 'Administrador', 'Gestion completa del sistema, catalogos, seguimiento y configuracion operativa.'),
  ('administradora', 'Administradora', 'Gestion completa del sistema, catalogos, seguimiento y configuracion operativa.'),
  ('supervisor', 'Supervisor', 'Seguimiento ejecutivo del avance, control de alertas y consulta de indicadores.'),
  ('responsable', 'Responsable', 'Gestion de sus tareas, actualizacion de avances y consulta de historial.'),
  ('consulta', 'Consulta', 'Acceso de solo lectura a paneles, cronograma, alertas e historial.')
ON CONFLICT (codigo) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;

CREATE OR REPLACE FUNCTION resolve_default_tipo_usuario_id()
RETURNS SMALLINT AS $$
DECLARE
  default_id SMALLINT;
BEGIN
  SELECT id
  INTO default_id
  FROM tipos_usuario
  WHERE codigo = 'responsable'
  LIMIT 1;

  RETURN default_id;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS perfiles_usuario (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre_completo TEXT,
  tipo_usuario_id SMALLINT REFERENCES tipos_usuario(id) DEFAULT resolve_default_tipo_usuario_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_tipo_usuario_id
  ON perfiles_usuario(tipo_usuario_id);

CREATE OR REPLACE FUNCTION update_perfiles_usuario_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS perfiles_usuario_updated_at ON perfiles_usuario;

CREATE TRIGGER perfiles_usuario_updated_at
  BEFORE UPDATE ON perfiles_usuario
  FOR EACH ROW EXECUTE FUNCTION update_perfiles_usuario_updated_at();

CREATE OR REPLACE FUNCTION sync_perfil_usuario_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles_usuario (
    id,
    email,
    nombre_completo,
    tipo_usuario_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    resolve_default_tipo_usuario_id()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nombre_completo = COALESCE(EXCLUDED.nombre_completo, perfiles_usuario.nombre_completo),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;

CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_perfil_usuario_from_auth();

INSERT INTO perfiles_usuario (id, email, nombre_completo, tipo_usuario_id)
SELECT
  au.id,
  au.email,
  COALESCE(NULLIF(TRIM(au.raw_user_meta_data ->> 'full_name'), ''), split_part(au.email, '@', 1)),
  resolve_default_tipo_usuario_id()
FROM auth.users au
WHERE au.email IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  nombre_completo = COALESCE(perfiles_usuario.nombre_completo, EXCLUDED.nombre_completo),
  tipo_usuario_id = COALESCE(perfiles_usuario.tipo_usuario_id, EXCLUDED.tipo_usuario_id),
  updated_at = NOW();

ALTER TABLE tipos_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read tipos_usuario" ON tipos_usuario;
DROP POLICY IF EXISTS "Authenticated read own perfil" ON perfiles_usuario;
DROP POLICY IF EXISTS "Authenticated insert own perfil" ON perfiles_usuario;
DROP POLICY IF EXISTS "Authenticated update own perfil" ON perfiles_usuario;

CREATE POLICY "Authenticated read tipos_usuario"
ON tipos_usuario
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated read own perfil"
ON perfiles_usuario
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated insert own perfil"
ON perfiles_usuario
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated update own perfil"
ON perfiles_usuario
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
