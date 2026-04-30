-- ============================================================
-- MIGRACION: escalabilidad fase 2
-- RLS por alcance, RPCs agregadas e indices compuestos
-- Ejecutar despues de migration_responsables_notificaciones.sql
-- y migration_security_hardening.sql.
-- ============================================================

SET search_path = public;

-- Compatibilidad: algunas instalaciones ejecutaron migraciones parciales
-- donde responsables/tareas existen, pero departamentos no fue creado
-- porque vive en schema.sql.
CREATE TABLE IF NOT EXISTS public.departamentos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.departamentos (nombre) VALUES
  ('Gabinete'),
  (U&'Coordinación'),
  (U&'Servicios Técnicos'),
  ('Servicios Comerciales'),
  (U&'Asesoría Jurídica'),
  ('Servicios Financieros'),
  ('RRHH'),
  (U&'Suministro y Logística'),
  (U&'Servicios Informáticos'),
  ('Consejeros'),
  ('Asesores')
ON CONFLICT (nombre) DO NOTHING;

-- ------------------------------------------------------------
-- Helpers de rol y alcance
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_role_code()
RETURNS TEXT AS $$
  SELECT LOWER(tu.codigo)
  FROM public.perfiles_usuario pu
  JOIN public.tipos_usuario tu ON tu.id = pu.tipo_usuario_id
  WHERE pu.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_any_role(allowed_codes TEXT[])
RETURNS BOOLEAN AS $$
  SELECT COALESCE(public.current_role_code() = ANY (allowed_codes), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_user_departamentos()
RETURNS TEXT[] AS $$
  SELECT COALESCE(
    ARRAY_AGG(DISTINCT TRIM(r.departamento)) FILTER (
      WHERE r.departamento IS NOT NULL AND TRIM(r.departamento) <> ''
    ),
    ARRAY[]::TEXT[]
  )
  FROM public.responsables r
  WHERE r.usuario_id = auth.uid()
    AND COALESCE(r.activo, true) = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_read_tarea(
  p_responsable_usuario_id UUID,
  p_departamento TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  role_code TEXT;
  departamentos TEXT[];
BEGIN
  role_code := public.current_role_code();

  IF role_code IN ('administrador', 'administradora', 'consulta') THEN
    RETURN true;
  END IF;

  IF role_code = 'supervisor' THEN
    departamentos := public.current_user_departamentos();
    RETURN
      p_responsable_usuario_id = auth.uid()
      OR CARDINALITY(departamentos) = 0
      OR TRIM(COALESCE(p_departamento, '')) = ANY (departamentos);
  END IF;

  IF role_code = 'responsable' THEN
    RETURN p_responsable_usuario_id = auth.uid();
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_write_tarea(
  p_responsable_usuario_id UUID,
  p_departamento TEXT
)
RETURNS BOOLEAN AS $$
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
    RETURN
      p_responsable_usuario_id = auth.uid()
      OR CARDINALITY(departamentos) = 0
      OR TRIM(COALESCE(p_departamento, '')) = ANY (departamentos);
  END IF;

  IF role_code = 'responsable' THEN
    RETURN p_responsable_usuario_id = auth.uid();
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- Tablas base (asegurar existencia)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.departamentos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.departamentos (nombre) VALUES
  ('Gabinete'),
  (U&'Coordinación'),
  (U&'Servicios Técnicos'),
  ('Servicios Comerciales'),
  (U&'Asesoría Jurídica'),
  ('Servicios Financieros'),
  ('RRHH'),
  (U&'Suministro y Logística'),
  (U&'Servicios Informáticos'),
  ('Consejeros'),
  ('Asesores')
ON CONFLICT (nombre) DO NOTHING;

-- ------------------------------------------------------------
-- RLS por alcance
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
WITH CHECK (public.can_write_tarea(responsable_usuario_id, departamento));

CREATE POLICY "Scoped update tareas"
ON public.tareas
FOR UPDATE
TO authenticated
USING (public.can_write_tarea(responsable_usuario_id, departamento))
WITH CHECK (public.can_write_tarea(responsable_usuario_id, departamento));

CREATE POLICY "Scoped delete tareas"
ON public.tareas
FOR DELETE
TO authenticated
USING (public.can_write_tarea(responsable_usuario_id, departamento));

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
      AND public.can_write_tarea(t.responsable_usuario_id, t.departamento)
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

-- ------------------------------------------------------------
-- Indices para filtros frecuentes y pantallas agregadas
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tareas_scope_responsable_estado_fecha
  ON public.tareas(responsable_usuario_id, estado, fecha_fin DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_departamento_estado_fecha
  ON public.tareas(departamento, estado, fecha_fin DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_tipo_estado
  ON public.tareas(tipo_tarea, estado);

CREATE INDEX IF NOT EXISTS idx_tareas_created_desc
  ON public.tareas(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tareas_fecha_inicio_fin
  ON public.tareas(fecha_inicio, fecha_fin);

CREATE INDEX IF NOT EXISTS idx_alertas_destinatario_leida_created
  ON public.alertas(destinatario_usuario_id, leida, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_responsables_usuario_departamento
  ON public.responsables(usuario_id, departamento)
  WHERE activo = true;

-- ------------------------------------------------------------
-- RPCs agregadas. Son SECURITY INVOKER para respetar RLS.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.api_dashboard_data()
RETURNS JSONB AS $$
WITH scoped AS (
  SELECT
    id,
    codigo_id,
    tarea,
    prioridad,
    departamento,
    responsable,
    fecha_fin,
    porcentaje_avance,
    estado,
    created_at,
    updated_at,
    CASE
      WHEN fecha_fin IS NULL THEN U&'\26AA Sin fecha'
      WHEN fecha_fin < CURRENT_DATE THEN U&'\+01F534 Vencida'
      WHEN fecha_fin <= CURRENT_DATE + 2 THEN U&'\+01F7E0 Urgente'
      WHEN fecha_fin <= CURRENT_DATE + 5 THEN U&'\+01F7E1 Próxima'
      ELSE U&'\+01F7E2 A tiempo'
    END AS semaforo
  FROM public.tareas
),
kpis AS (
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'completadas', COUNT(*) FILTER (WHERE estado = 'Completado'),
    'enProceso', COUNT(*) FILTER (WHERE estado = 'En Proceso'),
    'pendientes', COUNT(*) FILTER (WHERE estado = 'Pendiente'),
    'alta', COUNT(*) FILTER (WHERE prioridad = 'Alta'),
    'vencidas', COUNT(*) FILTER (WHERE semaforo = U&'\+01F534 Vencida'),
    'avance', COALESCE(ROUND(AVG(porcentaje_avance))::INT, 0)
  ) AS data
  FROM scoped
),
dept AS (
  SELECT jsonb_agg(row_data ORDER BY total DESC) AS data
  FROM (
    SELECT
      jsonb_build_object(
        'name', CASE WHEN LENGTH(COALESCE(departamento, 'Sin asignar')) > 16
          THEN SUBSTRING(COALESCE(departamento, 'Sin asignar') FROM 1 FOR 16) || '...'
          ELSE COALESCE(departamento, 'Sin asignar')
        END,
        'total', COUNT(*),
        'completadas', COUNT(*) FILTER (WHERE estado = 'Completado'),
        'enProceso', COUNT(*) FILTER (WHERE estado = 'En Proceso'),
        'pendientes', COUNT(*) FILTER (WHERE estado = 'Pendiente')
      ) AS row_data,
      COUNT(*) AS total
    FROM scoped
    GROUP BY COALESCE(departamento, 'Sin asignar')
    ORDER BY COUNT(*) DESC
    LIMIT 8
  ) rows
),
resp AS (
  SELECT jsonb_agg(jsonb_build_array(nombre, stats) ORDER BY total DESC) AS data
  FROM (
    SELECT
      COALESCE(responsable, 'Sin asignar') AS nombre,
      jsonb_build_object(
        'total', COUNT(*),
        'completadas', COUNT(*) FILTER (WHERE estado = 'Completado'),
        'enProceso', COUNT(*) FILTER (WHERE estado = 'En Proceso'),
        'pendientes', COUNT(*) FILTER (WHERE estado = 'Pendiente')
      ) AS stats,
      COUNT(*) AS total
    FROM scoped
    GROUP BY COALESCE(responsable, 'Sin asignar')
    ORDER BY COUNT(*) DESC
    LIMIT 6
  ) rows
),
pie AS (
  SELECT jsonb_agg(item) AS data
  FROM (
    SELECT jsonb_build_object('name', label, 'value', value_count) AS item
    FROM (
      VALUES
        ('Completado', (SELECT COUNT(*) FROM scoped WHERE estado = 'Completado')),
        ('En proceso', (SELECT COUNT(*) FROM scoped WHERE estado = 'En Proceso')),
        ('Pendiente', (SELECT COUNT(*) FROM scoped WHERE estado = 'Pendiente')),
        ('Cancelado', (SELECT COUNT(*) FROM scoped WHERE estado = 'Cancelado'))
    ) AS v(label, value_count)
    WHERE value_count > 0
  ) rows
),
priority AS (
  SELECT jsonb_agg(item) AS data
  FROM (
    SELECT jsonb_build_object('name', label, 'value', value_count) AS item
    FROM (
      VALUES
        ('Alta', (SELECT COUNT(*) FROM scoped WHERE prioridad = 'Alta')),
        ('Media', (SELECT COUNT(*) FROM scoped WHERE prioridad = 'Media')),
        ('Baja', (SELECT COUNT(*) FROM scoped WHERE prioridad = 'Baja'))
    ) AS v(label, value_count)
    WHERE value_count > 0
  ) rows
),
recent AS (
  SELECT jsonb_agg(to_jsonb(r) ORDER BY COALESCE(r.updated_at, r.created_at) DESC) AS data
  FROM (
    SELECT id, codigo_id, tarea, prioridad, estado, updated_at, created_at
    FROM scoped
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 5
  ) r
)
SELECT jsonb_build_object(
  'kpis', COALESCE((SELECT data FROM kpis), '{}'::jsonb),
  'deptData', COALESCE((SELECT data FROM dept), '[]'::jsonb),
  'respData', COALESCE((SELECT data FROM resp), '[]'::jsonb),
  'pieData', COALESCE((SELECT data FROM pie), '[]'::jsonb),
  'priData', COALESCE((SELECT data FROM priority), '[]'::jsonb),
  'recientes', COALESCE((SELECT data FROM recent), '[]'::jsonb)
);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

CREATE OR REPLACE FUNCTION public.api_estadisticas_data()
RETURNS JSONB AS $$
WITH scoped AS (
  SELECT prioridad, tipo_tarea, departamento, estado, porcentaje_avance
  FROM public.tareas
),
prioridad_stats AS (
  SELECT jsonb_agg(item) AS data
  FROM (
    SELECT jsonb_build_object(
      'prioridad', prioridad,
      'total', COUNT(s.prioridad),
      'completadas', COUNT(*) FILTER (WHERE estado = 'Completado'),
      'en_proceso', COUNT(*) FILTER (WHERE estado = 'En Proceso'),
      'pendientes', COUNT(*) FILTER (WHERE estado = 'Pendiente')
    ) AS item
    FROM (VALUES ('Alta'), ('Media'), ('Baja')) AS p(prioridad)
    LEFT JOIN scoped s USING (prioridad)
    GROUP BY prioridad
    ORDER BY CASE prioridad WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END
  ) rows
),
tipo_stats AS (
  SELECT jsonb_agg(item) AS data
  FROM (
    SELECT jsonb_build_object(
      'tipo', tipo,
      'total', COUNT(s.tipo_tarea),
      'completadas', COUNT(*) FILTER (WHERE s.estado = 'Completado'),
      'en_proceso', COUNT(*) FILTER (WHERE s.estado = 'En Proceso'),
      'pendientes', COUNT(*) FILTER (WHERE s.estado = 'Pendiente'),
      'pct', CASE
        WHEN COUNT(s.tipo_tarea) = 0 THEN 0
        ELSE ROUND((COUNT(*) FILTER (WHERE s.estado = 'Completado')::NUMERIC / COUNT(s.tipo_tarea)) * 100)::INT
      END
    ) AS item
    FROM (VALUES ('Estratégica'), ('Técnica'), ('Administrativa'), ('Comercial'), ('Operativa')) AS t(tipo)
    LEFT JOIN scoped s ON s.tipo_tarea = t.tipo
    GROUP BY tipo
  ) rows
),
dept_stats_raw AS (
  SELECT
    COALESCE(departamento, 'Sin asignar') AS dpto_raw,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE estado = 'Completado') AS completadas,
    COUNT(*) FILTER (WHERE estado = 'En Proceso') AS en_proceso,
    COUNT(*) FILTER (WHERE estado = 'Pendiente') AS pendientes,
    COALESCE(ROUND(AVG(porcentaje_avance))::INT, 0) AS avance_prom
  FROM scoped
  GROUP BY COALESCE(departamento, 'Sin asignar')
),
dept_stats AS (
  SELECT jsonb_agg(item ORDER BY total DESC) AS data
  FROM (
    SELECT
      jsonb_build_object(
        'dpto', CASE WHEN LENGTH(dpto_raw) > 14 THEN SUBSTRING(dpto_raw FROM 1 FOR 14) || '...' ELSE dpto_raw END,
        'total', total,
        'completadas', completadas,
        'en_proceso', en_proceso,
        'pendientes', pendientes,
        'avance_prom', avance_prom
      ) AS item,
      total
    FROM dept_stats_raw
  ) rows
),
radar AS (
  SELECT jsonb_agg(item ORDER BY total DESC) AS data
  FROM (
    SELECT
      jsonb_build_object(
        'dept', CASE WHEN LENGTH(dpto_raw) > 14 THEN SUBSTRING(dpto_raw FROM 1 FOR 14) || '...' ELSE dpto_raw END,
        'completadas', completadas,
        'en_proceso', en_proceso,
        'pendientes', pendientes
      ) AS item,
      total
    FROM dept_stats_raw
    ORDER BY total DESC
    LIMIT 6
  ) rows
)
SELECT jsonb_build_object(
  'prioridadStats', COALESCE((SELECT data FROM prioridad_stats), '[]'::jsonb),
  'tipoStats', COALESCE((SELECT data FROM tipo_stats), '[]'::jsonb),
  'departamentoStats', COALESCE((SELECT data FROM dept_stats), '[]'::jsonb),
  'radarData', COALESCE((SELECT data FROM radar), '[]'::jsonb)
);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.api_dashboard_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.api_estadisticas_data() TO authenticated;
