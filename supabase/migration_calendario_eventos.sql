-- MIGRACION: calendario institucional por organismo
-- Ejecutar despues de las migraciones de organismos y miembros.
-- Objetivo:
--   Permitir que administradores de cada organismo fijen festivos y eventos
--   institucionales visibles para todos los miembros del organismo.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.calendario_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organismo_id UUID NOT NULL REFERENCES public.organismos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo_evento TEXT NOT NULL DEFAULT 'evento',
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  es_festivo BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT NOT NULL DEFAULT 'teal',
  creado_por_usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendario_eventos_titulo_check CHECK (TRIM(titulo) <> ''),
  CONSTRAINT calendario_eventos_tipo_check CHECK (tipo_evento IN ('festivo', 'evento', 'actividad', 'aviso', 'fecha_limite')),
  CONSTRAINT calendario_eventos_color_check CHECK (color IN ('teal', 'sky', 'amber', 'rose', 'violet', 'slate')),
  CONSTRAINT calendario_eventos_fechas_check CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_calendario_eventos_organismo_fecha
  ON public.calendario_eventos(organismo_id, fecha_inicio, COALESCE(fecha_fin, fecha_inicio));

CREATE INDEX IF NOT EXISTS idx_calendario_eventos_organismo_tipo
  ON public.calendario_eventos(organismo_id, tipo_evento);

CREATE OR REPLACE FUNCTION public.set_calendario_eventos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendario_eventos_updated_at ON public.calendario_eventos;
CREATE TRIGGER trg_calendario_eventos_updated_at
  BEFORE UPDATE ON public.calendario_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_calendario_eventos_updated_at();

ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendario_eventos_visibles_por_miembros" ON public.calendario_eventos;
CREATE POLICY "calendario_eventos_visibles_por_miembros"
ON public.calendario_eventos
FOR SELECT
USING (public.es_miembro_organismo(organismo_id));

DROP POLICY IF EXISTS "calendario_eventos_gestion_por_administradores" ON public.calendario_eventos;
CREATE POLICY "calendario_eventos_gestion_por_administradores"
ON public.calendario_eventos
FOR ALL
USING (public.es_admin_organismo(organismo_id))
WITH CHECK (public.es_admin_organismo(organismo_id));
