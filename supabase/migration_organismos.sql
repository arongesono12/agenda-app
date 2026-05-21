-- =============================================================================
-- MIGRACIÓN: Sistema Multi-Organismo
-- Ejecutar en el editor SQL de Supabase en el orden indicado.
-- =============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- FASE A: Tablas nuevas
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organismos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  tipo        TEXT NOT NULL DEFAULT 'corporativo'
                CHECK (tipo IN ('individual', 'corporativo')),
  logo_url    TEXT,
  website     TEXT,
  sector      TEXT,
  pais        TEXT DEFAULT 'ES',
  activo      BOOLEAN DEFAULT true,
  creado_por  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organismo_miembros (
  id            BIGSERIAL PRIMARY KEY,
  organismo_id  UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_codigo    TEXT NOT NULL DEFAULT 'responsable'
                  CHECK (rol_codigo IN ('administrador', 'administradora', 'supervisor', 'responsable', 'consulta')),
  activo        BOOLEAN DEFAULT true,
  invitado_por  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organismo_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS organismo_suscripciones (
  id                      BIGSERIAL PRIMARY KEY,
  organismo_id            UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  plan_codigo             TEXT NOT NULL
                            CHECK (plan_codigo IN ('individual', 'basico', 'pro', 'empresa')),
  estado                  TEXT NOT NULL DEFAULT 'prueba'
                            CHECK (estado IN ('activa', 'pausada', 'cancelada', 'prueba')),
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  periodo_inicio          TIMESTAMPTZ,
  periodo_fin             TIMESTAMPTZ,
  trial_fin               TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organismo_facturas (
  id                  BIGSERIAL PRIMARY KEY,
  organismo_id        UUID NOT NULL REFERENCES organismos(id),
  stripe_invoice_id   TEXT UNIQUE,
  importe_centimos    INTEGER NOT NULL,
  moneda              TEXT DEFAULT 'eur',
  estado              TEXT CHECK (estado IN ('pagada', 'pendiente', 'fallida', 'anulada')),
  pdf_url             TEXT,
  fecha_emision       TIMESTAMPTZ,
  fecha_vencimiento   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organismo_invitaciones (
  id            BIGSERIAL PRIMARY KEY,
  organismo_id  UUID NOT NULL REFERENCES organismos(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  rol_codigo    TEXT NOT NULL DEFAULT 'responsable',
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  usado         BOOLEAN DEFAULT false,
  expira_at     TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  invitado_por  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- FASE B: Añadir organismo_id a tablas existentes (NULLABLE primero)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE tareas          ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES organismos(id);
ALTER TABLE responsables    ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES organismos(id);
ALTER TABLE departamentos   ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES organismos(id);
ALTER TABLE historial       ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES organismos(id);
ALTER TABLE alertas         ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES organismos(id);

-- Índices de tenant
CREATE INDEX IF NOT EXISTS idx_tareas_org        ON tareas(organismo_id);
CREATE INDEX IF NOT EXISTS idx_responsables_org  ON responsables(organismo_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_org ON departamentos(organismo_id);
CREATE INDEX IF NOT EXISTS idx_historial_org     ON historial(organismo_id);
CREATE INDEX IF NOT EXISTS idx_alertas_org       ON alertas(organismo_id);

-- ────────────────────────────────────────────────────────────────────────────
-- FASE C: Organismo semilla Segesa + migración de datos existentes
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Crear organismo semilla con UUID fijo
INSERT INTO organismos (id, nombre, slug, tipo, activo, creado_por)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Segesa',
  'segesa',
  'corporativo',
  true,
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- 2. Migrar todos los perfiles existentes como miembros de Segesa
INSERT INTO organismo_miembros (organismo_id, usuario_id, rol_codigo)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  COALESCE(tu.codigo, 'responsable')
FROM perfiles_usuario p
LEFT JOIN tipos_usuario tu ON tu.id = p.tipo_usuario_id
ON CONFLICT (organismo_id, usuario_id) DO NOTHING;

-- 3. Asignar organismo_id a todos los datos existentes
UPDATE tareas          SET organismo_id = '00000000-0000-0000-0000-000000000001' WHERE organismo_id IS NULL;
UPDATE responsables    SET organismo_id = '00000000-0000-0000-0000-000000000001' WHERE organismo_id IS NULL;
UPDATE departamentos   SET organismo_id = '00000000-0000-0000-0000-000000000001' WHERE organismo_id IS NULL;
UPDATE historial       SET organismo_id = '00000000-0000-0000-0000-000000000001' WHERE organismo_id IS NULL;
UPDATE alertas         SET organismo_id = '00000000-0000-0000-0000-000000000001' WHERE organismo_id IS NULL;

-- 4. Hacer NOT NULL ahora que todos tienen valor
ALTER TABLE tareas          ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE responsables    ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE departamentos   ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE historial       ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE alertas         ALTER COLUMN organismo_id SET NOT NULL;

-- 5. Suscripción activa para Segesa (plan empresa)
INSERT INTO organismo_suscripciones (organismo_id, plan_codigo, estado)
VALUES ('00000000-0000-0000-0000-000000000001', 'empresa', 'activa')
ON CONFLICT DO NOTHING;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- FASE D: Row Level Security
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE organismos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE organismo_miembros      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organismo_suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE organismo_facturas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE organismo_invitaciones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE departamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial               ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas                 ENABLE ROW LEVEL SECURITY;

-- Politicas para organismos sin recursion RLS
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

CREATE POLICY "organismos_miembros_pueden_ver" ON organismos
  FOR SELECT USING (public.es_miembro_organismo(id));

CREATE POLICY "miembros_visibles_en_organismo" ON organismo_miembros
  FOR SELECT USING (public.es_miembro_organismo(organismo_id));

CREATE POLICY "solo_admin_gestiona_miembros_insert" ON organismo_miembros
  FOR INSERT WITH CHECK (public.es_admin_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_tareas" ON tareas
  FOR ALL USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_responsables" ON responsables
  FOR ALL USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_departamentos" ON departamentos
  FOR ALL USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "aislamiento_por_organismo_historial" ON historial
  FOR ALL USING (public.es_miembro_organismo(organismo_id))
  WITH CHECK (public.es_miembro_organismo(organismo_id));

CREATE POLICY "alertas_propias" ON alertas
  FOR ALL USING (
    destinatario_usuario_id = auth.uid()
  );

CREATE POLICY "suscripciones_visibles" ON organismo_suscripciones
  FOR SELECT USING (public.es_miembro_organismo(organismo_id));

CREATE POLICY "facturas_visibles" ON organismo_facturas
  FOR SELECT USING (public.es_miembro_organismo(organismo_id));

CREATE POLICY "invitaciones_visibles" ON organismo_invitaciones
  FOR SELECT USING (public.es_miembro_organismo(organismo_id));
