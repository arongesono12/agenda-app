-- ============================================================
-- CONTROL AUTOMATIZADO AGENDA - Esquema Supabase
-- ============================================================

-- Tabla principal de tareas
CREATE TABLE IF NOT EXISTS tareas (
  id BIGSERIAL PRIMARY KEY,
  codigo_id INTEGER UNIQUE,
  tarea TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  departamento TEXT,
  seccion TEXT,
  responsable TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  dias_totales INTEGER GENERATED ALWAYS AS (
    CASE WHEN fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL
    THEN (fecha_fin - fecha_inicio)::INTEGER ELSE NULL END
  ) STORED,
  porcentaje_avance NUMERIC(5,2) DEFAULT 0 CHECK (porcentaje_avance BETWEEN 0 AND 100),
  dias_restantes INTEGER,
  semaforo TEXT,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Proceso', 'Completado', 'Cancelado')),
  tipo_tarea TEXT,
  ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY (con.conkey)
  WHERE rel.relname = 'tareas'
    AND con.contype = 'c'
    AND attr.attname = 'tipo_tarea'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE tareas DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Tabla de departamentos
CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de responsables
CREATE TABLE IF NOT EXISTS responsables (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  departamento TEXT,
  cargo TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de historial de cambios
CREATE TABLE IF NOT EXISTS historial (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  usuario TEXT DEFAULT 'Sistema',
  tarea_id BIGINT REFERENCES tareas(id) ON DELETE SET NULL,
  tarea_nombre TEXT,
  modulo TEXT DEFAULT 'Agenda de Control',
  tipo_cambio TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  observaciones TEXT
);

-- Tabla de alertas
CREATE TABLE IF NOT EXISTS alertas (
  id BIGSERIAL PRIMARY KEY,
  tarea_id BIGINT REFERENCES tareas(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('Vencida', 'Urgente', U&'Pr\00F3xima')),
  fecha_alerta DATE DEFAULT CURRENT_DATE,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar datos de catálogos
INSERT INTO departamentos (nombre) VALUES
  ('Gabinete'),
  (U&'Coordinaci\00F3n'),
  (U&'Servicios T\00E9cnicos'),
  ('Servicios Comerciales'),
  (U&'Asesor\00EDa Jur\00EDdica'),
  ('Servicios Financieros'),
  ('RRHH'),
  (U&'Suministro y Log\00EDstica'),
  (U&'Servicios Inform\00E1ticos'),
  ('Consejeros'),
  ('Asesores')
ON CONFLICT (nombre) DO NOTHING;

-- Trigger para campos calculados
CREATE OR REPLACE FUNCTION sync_tarea_calculated_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dias_restantes = CASE
    WHEN NEW.fecha_fin IS NOT NULL THEN (NEW.fecha_fin - CURRENT_DATE)::INTEGER
    ELSE NULL
  END;

  NEW.semaforo = CASE
    WHEN NEW.fecha_fin IS NULL THEN U&'\26AA Sin fecha'
    WHEN NEW.fecha_fin < CURRENT_DATE THEN U&'\+01F534 Vencida'
    WHEN NEW.fecha_fin <= CURRENT_DATE + 2 THEN U&'\+01F7E0 Urgente'
    WHEN NEW.fecha_fin <= CURRENT_DATE + 5 THEN U&'\+01F7E1 Pr\00F3xima'
    ELSE U&'\+01F7E2 A tiempo'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tareas_sync_calculated_fields ON tareas;

CREATE TRIGGER tareas_sync_calculated_fields
  BEFORE INSERT OR UPDATE OF fecha_fin ON tareas
  FOR EACH ROW EXECUTE FUNCTION sync_tarea_calculated_fields();

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tareas_updated_at ON tareas;

CREATE TRIGGER tareas_updated_at
  BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger para historial automático
CREATE OR REPLACE FUNCTION log_tarea_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO historial (tarea_id, tarea_nombre, tipo_cambio, valor_nuevo)
    VALUES (NEW.id, NEW.tarea, U&'Creaci\00F3n', NEW.estado);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estado != NEW.estado THEN
      INSERT INTO historial (tarea_id, tarea_nombre, tipo_cambio, valor_anterior, valor_nuevo)
      VALUES (NEW.id, NEW.tarea, 'Cambio de Estado', OLD.estado, NEW.estado);
    END IF;
    IF OLD.porcentaje_avance != NEW.porcentaje_avance THEN
      INSERT INTO historial (tarea_id, tarea_nombre, tipo_cambio, valor_anterior, valor_nuevo)
      VALUES (
        NEW.id,
        NEW.tarea,
        U&'Actualizaci\00F3n % Avance',
        OLD.porcentaje_avance::TEXT || '%',
        NEW.porcentaje_avance::TEXT || '%'
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO historial (tarea_nombre, tipo_cambio, valor_anterior)
    VALUES (OLD.tarea, U&'Eliminaci\00F3n', OLD.estado);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tareas_historial ON tareas;

CREATE TRIGGER tareas_historial
  AFTER INSERT OR UPDATE OR DELETE ON tareas
  FOR EACH ROW EXECUTE FUNCTION log_tarea_changes();

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_departamento ON tareas(departamento);
CREATE INDEX IF NOT EXISTS idx_tareas_responsable ON tareas(responsable);
CREATE INDEX IF NOT EXISTS idx_tareas_prioridad ON tareas(prioridad);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_fin ON tareas(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial(fecha DESC);

-- RLS (Row Level Security) - acceso público sin autenticación
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

CREATE POLICY "Public access tareas" ON tareas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access departamentos" ON departamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access responsables" ON responsables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access historial" ON historial FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access alertas" ON alertas FOR ALL USING (true) WITH CHECK (true);

-- Vista de estadísticas por departamento
CREATE OR REPLACE VIEW stats_departamento AS
SELECT
  departamento,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE prioridad = 'Alta') as alta_prioridad,
  COUNT(*) FILTER (WHERE estado = 'En Proceso') as en_proceso,
  COUNT(*) FILTER (WHERE estado = 'Completado') as completadas,
  COUNT(*) FILTER (WHERE estado = 'Pendiente') as pendientes,
  ROUND(AVG(porcentaje_avance), 1) as avance_promedio
FROM tareas
WHERE departamento IS NOT NULL
GROUP BY departamento;

-- Vista de alertas activas
CREATE OR REPLACE VIEW alertas_activas AS
SELECT
  id, tarea, responsable, departamento, fecha_fin, prioridad, estado,
  semaforo,
  dias_restantes,
  CASE
    WHEN fecha_fin < CURRENT_DATE THEN 1
    WHEN fecha_fin <= CURRENT_DATE + 2 THEN 2
    ELSE 3
  END as orden_alerta
FROM tareas
WHERE fecha_fin <= CURRENT_DATE + 5
  AND estado NOT IN ('Completado', 'Cancelado')
ORDER BY orden_alerta, fecha_fin;
