-- =============================================================================
-- ENSURE: todo el contenido existente queda bajo el Organismo Segesa
-- Ejecutar en Supabase SQL Editor. Es idempotente y seguro para repetir.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0. Tablas mínimas de organismo si la migración completa aún no se aplicó
CREATE TABLE IF NOT EXISTS public.organismos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  tipo        TEXT NOT NULL DEFAULT 'corporativo',
  logo_url    TEXT,
  website     TEXT,
  sector      TEXT,
  pais        TEXT DEFAULT 'GQ',
  activo      BOOLEAN DEFAULT true,
  creado_por  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organismo_miembros (
  id            BIGSERIAL PRIMARY KEY,
  organismo_id  UUID NOT NULL REFERENCES public.organismos(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol_codigo    TEXT NOT NULL DEFAULT 'responsable',
  activo        BOOLEAN DEFAULT true,
  invitado_por  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organismo_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.organismo_suscripciones (
  id                      BIGSERIAL PRIMARY KEY,
  organismo_id            UUID NOT NULL REFERENCES public.organismos(id) ON DELETE CASCADE,
  plan_codigo             TEXT NOT NULL,
  estado                  TEXT NOT NULL DEFAULT 'activa',
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  periodo_inicio          TIMESTAMPTZ,
  periodo_fin             TIMESTAMPTZ,
  trial_fin               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Organismo semilla Segesa
INSERT INTO public.organismos (id, nombre, slug, tipo, activo, creado_por)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Segesa',
  'segesa',
  'corporativo',
  true,
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
)
ON CONFLICT (id) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  slug = EXCLUDED.slug,
  tipo = EXCLUDED.tipo,
  activo = true,
  updated_at = NOW();

-- 2. Columnas de organismo en tablas visibles por la app
ALTER TABLE public.tareas        ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES public.organismos(id);
ALTER TABLE public.responsables  ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES public.organismos(id);
ALTER TABLE public.departamentos ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES public.organismos(id);
ALTER TABLE public.historial     ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES public.organismos(id);
ALTER TABLE public.alertas       ADD COLUMN IF NOT EXISTS organismo_id UUID REFERENCES public.organismos(id);

-- 3. Índices de tenant
CREATE INDEX IF NOT EXISTS idx_tareas_org        ON public.tareas(organismo_id);
CREATE INDEX IF NOT EXISTS idx_responsables_org  ON public.responsables(organismo_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_org ON public.departamentos(organismo_id);
CREATE INDEX IF NOT EXISTS idx_historial_org     ON public.historial(organismo_id);
CREATE INDEX IF NOT EXISTS idx_alertas_org       ON public.alertas(organismo_id);

-- 4. Todo dato existente pertenece a Segesa en esta instalación
UPDATE public.tareas
SET organismo_id = '00000000-0000-0000-0000-000000000001'
WHERE organismo_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

UPDATE public.responsables
SET organismo_id = '00000000-0000-0000-0000-000000000001'
WHERE organismo_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

UPDATE public.departamentos
SET organismo_id = '00000000-0000-0000-0000-000000000001'
WHERE organismo_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

UPDATE public.historial
SET organismo_id = '00000000-0000-0000-0000-000000000001'
WHERE organismo_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

UPDATE public.alertas
SET organismo_id = '00000000-0000-0000-0000-000000000001'
WHERE organismo_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

-- 5. Todos los perfiles actuales son miembros de Segesa con su rol actual
INSERT INTO public.organismo_miembros (organismo_id, usuario_id, rol_codigo, activo)
SELECT
  '00000000-0000-0000-0000-000000000001',
  p.id,
  COALESCE(tu.codigo, 'responsable'),
  true
FROM public.perfiles_usuario p
LEFT JOIN public.tipos_usuario tu ON tu.id = p.tipo_usuario_id
ON CONFLICT (organismo_id, usuario_id) DO UPDATE
SET
  rol_codigo = EXCLUDED.rol_codigo,
  activo = true;

-- 6. Suscripción empresa activa para Segesa
UPDATE public.organismo_suscripciones
SET
  plan_codigo = 'empresa',
  estado = 'activa',
  updated_at = NOW()
WHERE organismo_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.organismo_suscripciones (organismo_id, plan_codigo, estado, periodo_inicio)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'empresa',
  'activa',
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.organismo_suscripciones
  WHERE organismo_id = '00000000-0000-0000-0000-000000000001'
);

-- 7. A partir de aquí, los datos principales deben tener organismo
ALTER TABLE public.tareas        ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE public.responsables  ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE public.departamentos ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE public.historial     ALTER COLUMN organismo_id SET NOT NULL;
ALTER TABLE public.alertas       ALTER COLUMN organismo_id SET NOT NULL;

COMMIT;
