-- MIGRACION: festivos oficiales de Guinea Ecuatorial para el calendario
-- Ejecutar despues de supabase/migration_calendario_eventos.sql.
-- Incluye fechas fijas y fechas moviles basadas en Pascua:
--   Viernes Santo = Pascua - 2 dias
--   Corpus Christi = Pascua + 60 dias
-- La festividad local de Santa Isabel de Hungria se registra como evento local de referencia.

ALTER TABLE public.calendario_eventos
  ADD COLUMN IF NOT EXISTS origen TEXT,
  ADD COLUMN IF NOT EXISTS codigo_origen TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendario_eventos_origen_unico
  ON public.calendario_eventos(organismo_id, codigo_origen, fecha_inicio)
  WHERE codigo_origen IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fecha_pascua_gregoriana(p_year INTEGER)
RETURNS DATE AS $$
DECLARE
  a INTEGER;
  b INTEGER;
  c INTEGER;
  d INTEGER;
  e INTEGER;
  f INTEGER;
  g INTEGER;
  h INTEGER;
  i INTEGER;
  k INTEGER;
  l INTEGER;
  m INTEGER;
  month_num INTEGER;
  day_num INTEGER;
BEGIN
  a := p_year % 19;
  b := floor(p_year / 100);
  c := p_year % 100;
  d := floor(b / 4);
  e := b % 4;
  f := floor((b + 8) / 25);
  g := floor((b - f + 1) / 3);
  h := (19 * a + b - d - g + 15) % 30;
  i := floor(c / 4);
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := floor((a + 11 * h + 22 * l) / 451);
  month_num := floor((h + l - 7 * m + 114) / 31);
  day_num := ((h + l - 7 * m + 114) % 31) + 1;

  RETURN make_date(p_year, month_num, day_num);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.festivos_guinea_ecuatorial(p_year INTEGER)
RETURNS TABLE (
  codigo_origen TEXT,
  titulo TEXT,
  descripcion TEXT,
  fecha_inicio DATE,
  tipo_evento TEXT,
  color TEXT,
  es_festivo BOOLEAN
) AS $$
DECLARE
  pascua DATE;
BEGIN
  pascua := public.fecha_pascua_gregoriana(p_year);

  RETURN QUERY
  SELECT * FROM (VALUES
    ('gq_ano_nuevo', 'Dia de Ano Nuevo', 'Festividad internacional oficial.', make_date(p_year, 1, 1), 'festivo', 'rose', TRUE),
    ('gq_viernes_santo', 'Viernes Santo', 'Festividad religiosa de fecha movil segun el calendario liturgico.', pascua - 2, 'festivo', 'rose', TRUE),
    ('gq_dia_trabajo', 'Dia del Trabajo', 'Festividad internacional oficial.', make_date(p_year, 5, 1), 'festivo', 'rose', TRUE),
    ('gq_dia_presidente', 'Dia del Presidente', 'Fiesta nacional y civica.', make_date(p_year, 6, 5), 'festivo', 'rose', TRUE),
    ('gq_corpus_christi', 'Corpus Christi', 'Festividad religiosa de fecha movil, normalmente celebrada en junio.', pascua + 60, 'festivo', 'rose', TRUE),
    ('gq_dia_libertad', 'Dia de la Libertad', 'Tambien conocido como Dia de las Fuerzas Armadas.', make_date(p_year, 8, 3), 'festivo', 'rose', TRUE),
    ('gq_constitucion', 'Dia de la Constitucion', 'Fiesta nacional y civica.', make_date(p_year, 8, 15), 'festivo', 'rose', TRUE),
    ('gq_independencia', 'Dia de la Independencia', 'Fiesta nacional de Guinea Ecuatorial.', make_date(p_year, 10, 12), 'festivo', 'rose', TRUE),
    ('gq_todos_santos', 'Dia de Todos los Santos', 'Festividad religiosa oficial.', make_date(p_year, 11, 1), 'festivo', 'rose', TRUE),
    ('gq_santa_isabel_malabo', 'Santa Isabel de Hungria', 'Festividad local de referencia en Malabo, patrona de la ciudad.', make_date(p_year, 11, 17), 'evento', 'violet', FALSE),
    ('gq_inmaculada', 'Inmaculada Concepcion', 'Festividad religiosa oficial.', make_date(p_year, 12, 8), 'festivo', 'rose', TRUE),
    ('gq_navidad', 'Navidad', 'Festividad internacional y religiosa oficial.', make_date(p_year, 12, 25), 'festivo', 'rose', TRUE)
  ) AS holidays(codigo_origen, titulo, descripcion, fecha_inicio, tipo_evento, color, es_festivo);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.sembrar_festivos_guinea_ecuatorial(
  p_organismo_id UUID,
  p_year INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.calendario_eventos (
    organismo_id,
    titulo,
    descripcion,
    tipo_evento,
    fecha_inicio,
    fecha_fin,
    es_festivo,
    color,
    origen,
    codigo_origen
  )
  SELECT
    p_organismo_id,
    h.titulo,
    h.descripcion,
    h.tipo_evento,
    h.fecha_inicio,
    NULL,
    h.es_festivo,
    h.color,
    'festivos_guinea_ecuatorial',
    h.codigo_origen
  FROM public.festivos_guinea_ecuatorial(p_year) h
  ON CONFLICT (organismo_id, codigo_origen, fecha_inicio)
  WHERE codigo_origen IS NOT NULL
  DO UPDATE SET
    titulo = EXCLUDED.titulo,
    descripcion = EXCLUDED.descripcion,
    tipo_evento = EXCLUDED.tipo_evento,
    es_festivo = EXCLUDED.es_festivo,
    color = EXCLUDED.color,
    origen = EXCLUDED.origen;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sembrar_festivos_guinea_ecuatorial_para_organismo()
RETURNS TRIGGER AS $$
DECLARE
  target_year INTEGER;
BEGIN
  FOR target_year IN
    SELECT generate_series(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 4)
  LOOP
    PERFORM public.sembrar_festivos_guinea_ecuatorial(NEW.id, target_year);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organismos_sembrar_festivos_gq ON public.organismos;
CREATE TRIGGER trg_organismos_sembrar_festivos_gq
  AFTER INSERT ON public.organismos
  FOR EACH ROW
  EXECUTE FUNCTION public.sembrar_festivos_guinea_ecuatorial_para_organismo();

DO $$
DECLARE
  org RECORD;
  target_year INTEGER;
BEGIN
  FOR org IN SELECT id FROM public.organismos WHERE activo = TRUE LOOP
    FOR target_year IN
      SELECT generate_series(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 4)
    LOOP
      PERFORM public.sembrar_festivos_guinea_ecuatorial(org.id, target_year);
    END LOOP;
  END LOOP;
END $$;
