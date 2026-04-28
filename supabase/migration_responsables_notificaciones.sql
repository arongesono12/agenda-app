-- ============================================================
-- MIGRACION: responsables con usuario, alertas internas y email
-- Ejecutar despues de schema.sql. Tambien crea perfiles/roles si faltan.
-- ============================================================

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.tipos_usuario (
  id SMALLSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.tipos_usuario (codigo, nombre, descripcion)
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

CREATE OR REPLACE FUNCTION public.resolve_default_tipo_usuario_id()
RETURNS SMALLINT AS $$
DECLARE
  default_id SMALLINT;
BEGIN
  SELECT id
  INTO default_id
  FROM public.tipos_usuario
  WHERE codigo = 'responsable'
  LIMIT 1;

  RETURN default_id;
END;
$$ LANGUAGE plpgsql;

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

CREATE TABLE IF NOT EXISTS public.tareas (
  id BIGSERIAL PRIMARY KEY,
  codigo_id INTEGER UNIQUE,
  tarea TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'Media',
  departamento TEXT,
  seccion TEXT,
  responsable TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  dias_totales INTEGER GENERATED ALWAYS AS (
    CASE WHEN fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
    THEN (fecha_fin - fecha_inicio)::INTEGER ELSE NULL END
  ) STORED,
  porcentaje_avance NUMERIC(5,2) DEFAULT 0,
  dias_restantes INTEGER,
  semaforo TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  tipo_tarea TEXT,
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tareas_prioridad_check'
      AND conrelid = 'public.tareas'::regclass
  ) THEN
    ALTER TABLE public.tareas
      ADD CONSTRAINT tareas_prioridad_check
      CHECK (prioridad IN ('Alta', 'Media', 'Baja'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tareas_estado_check'
      AND conrelid = 'public.tareas'::regclass
  ) THEN
    ALTER TABLE public.tareas
      ADD CONSTRAINT tareas_estado_check
      CHECK (estado IN ('Pendiente', 'En Proceso', 'Completado', 'Cancelado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tareas_porcentaje_avance_check'
      AND conrelid = 'public.tareas'::regclass
  ) THEN
    ALTER TABLE public.tareas
      ADD CONSTRAINT tareas_porcentaje_avance_check
      CHECK (porcentaje_avance BETWEEN 0 AND 100);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.alertas (
  id BIGSERIAL PRIMARY KEY,
  tarea_id BIGINT REFERENCES public.tareas(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL,
  fecha_alerta DATE DEFAULT CURRENT_DATE,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.historial (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  usuario TEXT DEFAULT 'Sistema',
  tarea_id BIGINT REFERENCES public.tareas(id) ON DELETE SET NULL,
  tarea_nombre TEXT,
  modulo TEXT DEFAULT 'Agenda de Control',
  tipo_cambio TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  observaciones TEXT
);

CREATE INDEX IF NOT EXISTS idx_historial_fecha
  ON public.historial(fecha DESC);

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
  ON public.responsables (LOWER(email))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE INDEX IF NOT EXISTS idx_responsables_usuario_id
  ON public.responsables(usuario_id);

CREATE OR REPLACE FUNCTION public.sync_responsable_usuario_id()
RETURNS TRIGGER AS $$
DECLARE
  perfil_id UUID;
BEGIN
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    NEW.usuario_id = NULL;
    RETURN NEW;
  END IF;

  NEW.email = LOWER(TRIM(NEW.email));

  SELECT id
  INTO perfil_id
  FROM public.perfiles_usuario
  WHERE LOWER(email) = NEW.email
  LIMIT 1;

  NEW.usuario_id = perfil_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS responsables_sync_usuario_id ON public.responsables;

CREATE TRIGGER responsables_sync_usuario_id
  BEFORE INSERT OR UPDATE OF email ON public.responsables
  FOR EACH ROW EXECUTE FUNCTION public.sync_responsable_usuario_id();

UPDATE public.responsables r
SET email = LOWER(TRIM(pu.email)),
    usuario_id = pu.id
FROM public.perfiles_usuario pu
WHERE r.email IS NULL
  AND LOWER(TRIM(r.nombre)) = LOWER(TRIM(COALESCE(pu.nombre_completo, split_part(pu.email, '@', 1))));

ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS responsable_id INTEGER REFERENCES public.responsables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_responsable_id
  ON public.tareas(responsable_id);

CREATE INDEX IF NOT EXISTS idx_tareas_responsable_usuario_id
  ON public.tareas(responsable_usuario_id);

UPDATE public.tareas t
SET responsable_id = r.id,
    responsable_usuario_id = r.usuario_id
FROM public.responsables r
WHERE t.responsable_id IS NULL
  AND t.responsable IS NOT NULL
  AND LOWER(TRIM(t.responsable)) = LOWER(TRIM(r.nombre));

ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS destinatario_usuario_id UUID REFERENCES public.perfiles_usuario(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS destinatario_email TEXT,
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS mensaje TEXT,
  ADD COLUMN IF NOT EXISTS enviada_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS alerta_key TEXT;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY (con.conkey)
  WHERE rel.relname = 'alertas'
    AND con.contype = 'c'
    AND attr.attname = 'tipo_alerta'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.alertas DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.alertas
    ADD CONSTRAINT alertas_tipo_alerta_check
    CHECK (
      tipo_alerta IN ('Asignada', 'Vencida', 'Urgente', 'Proxima', 'Próxima')
      OR tipo_alerta = 'Completada'
      OR tipo_alerta LIKE 'Pr%xima'
    );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_alerta_key_unique
  ON public.alertas(alerta_key)
  WHERE alerta_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alertas_destinatario_usuario_id
  ON public.alertas(destinatario_usuario_id);

CREATE INDEX IF NOT EXISTS idx_alertas_tarea_destinatario
  ON public.alertas(tarea_id, destinatario_usuario_id);
