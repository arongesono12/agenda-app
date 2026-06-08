-- MIGRACION: modulo de reuniones por organismo
-- Ejecutar despues de migration_organismos.sql y migration_responsables_notificaciones.sql.
-- Punto importante:
--   Las alertas existentes estaban acopladas a tareas mediante tarea_id. Para que una
--   invitacion de reunion llegue a los miembros sin ser descartada por filtros de tareas,
--   se agregan modulo/referencia_id y se deja tarea_id solo para alertas de tareas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.reuniones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organismo_id UUID NOT NULL REFERENCES public.organismos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ,
  modalidad TEXT NOT NULL DEFAULT 'virtual',
  enlace_reunion TEXT,
  ubicacion TEXT,
  estado TEXT NOT NULL DEFAULT 'programada',
  creada_por_usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reuniones_titulo_check CHECK (TRIM(titulo) <> ''),
  CONSTRAINT reuniones_modalidad_check CHECK (modalidad IN ('virtual', 'presencial', 'hibrida')),
  CONSTRAINT reuniones_estado_check CHECK (estado IN ('programada', 'cancelada', 'finalizada')),
  CONSTRAINT reuniones_fechas_check CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);

CREATE TABLE IF NOT EXISTS public.reunion_invitados (
  id BIGSERIAL PRIMARY KEY,
  reunion_id UUID NOT NULL REFERENCES public.reuniones(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nombre TEXT,
  estado_respuesta TEXT NOT NULL DEFAULT 'pendiente',
  token_confirmacion UUID NOT NULL DEFAULT gen_random_uuid(),
  respondido_at TIMESTAMPTZ,
  invitado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reunion_invitados_estado_check CHECK (estado_respuesta IN ('pendiente', 'confirmado', 'rechazado', 'tentativo')),
  CONSTRAINT reunion_invitados_destinatario_check CHECK (usuario_id IS NOT NULL OR NULLIF(TRIM(COALESCE(email, '')), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reunion_invitados_reunion_usuario
  ON public.reunion_invitados(reunion_id, usuario_id)
  WHERE usuario_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reunion_invitados_reunion_email
  ON public.reunion_invitados(reunion_id, LOWER(email))
  WHERE email IS NOT NULL AND TRIM(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reunion_invitados_token
  ON public.reunion_invitados(token_confirmacion);

CREATE INDEX IF NOT EXISTS idx_reuniones_organismo_fecha
  ON public.reuniones(organismo_id, fecha_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_reunion_invitados_usuario_estado
  ON public.reunion_invitados(usuario_id, estado_respuesta, invitado_at DESC);

CREATE OR REPLACE FUNCTION public.set_reuniones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reuniones_updated_at ON public.reuniones;
CREATE TRIGGER trg_reuniones_updated_at
  BEFORE UPDATE ON public.reuniones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reuniones_updated_at();

ALTER TABLE public.reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunion_invitados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reuniones_visibles_por_miembros" ON public.reuniones;
CREATE POLICY "reuniones_visibles_por_miembros"
ON public.reuniones
FOR SELECT
USING (public.es_miembro_organismo(organismo_id));

DROP POLICY IF EXISTS "reuniones_gestion_por_responsables_de_organismo" ON public.reuniones;
CREATE POLICY "reuniones_gestion_por_responsables_de_organismo"
ON public.reuniones
FOR ALL
USING (public.es_admin_organismo(organismo_id) OR EXISTS (
  SELECT 1
  FROM public.organismo_miembros om
  WHERE om.organismo_id = reuniones.organismo_id
    AND om.usuario_id = auth.uid()
    AND om.activo = TRUE
    AND om.rol_codigo IN ('superusuario', 'administrador', 'administradora', 'supervisor')
))
WITH CHECK (public.es_admin_organismo(organismo_id) OR EXISTS (
  SELECT 1
  FROM public.organismo_miembros om
  WHERE om.organismo_id = reuniones.organismo_id
    AND om.usuario_id = auth.uid()
    AND om.activo = TRUE
    AND om.rol_codigo IN ('superusuario', 'administrador', 'administradora', 'supervisor')
));

DROP POLICY IF EXISTS "reunion_invitados_visibles_por_miembros" ON public.reunion_invitados;
CREATE POLICY "reunion_invitados_visibles_por_miembros"
ON public.reunion_invitados
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.reuniones r
  WHERE r.id = reunion_invitados.reunion_id
    AND public.es_miembro_organismo(r.organismo_id)
));

DROP POLICY IF EXISTS "reunion_invitados_respuesta_propia" ON public.reunion_invitados;
CREATE POLICY "reunion_invitados_respuesta_propia"
ON public.reunion_invitados
FOR UPDATE
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "reunion_invitados_gestion_por_creadores" ON public.reunion_invitados;
CREATE POLICY "reunion_invitados_gestion_por_creadores"
ON public.reunion_invitados
FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.reuniones r
  JOIN public.organismo_miembros om ON om.organismo_id = r.organismo_id
  WHERE r.id = reunion_invitados.reunion_id
    AND om.usuario_id = auth.uid()
    AND om.activo = TRUE
    AND om.rol_codigo IN ('superusuario', 'administrador', 'administradora', 'supervisor')
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.reuniones r
  JOIN public.organismo_miembros om ON om.organismo_id = r.organismo_id
  WHERE r.id = reunion_invitados.reunion_id
    AND om.usuario_id = auth.uid()
    AND om.activo = TRUE
    AND om.rol_codigo IN ('superusuario', 'administrador', 'administradora', 'supervisor')
));

ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS modulo TEXT NOT NULL DEFAULT 'tareas',
  ADD COLUMN IF NOT EXISTS referencia_id TEXT;

UPDATE public.alertas
SET modulo = 'tareas',
    referencia_id = COALESCE(referencia_id, tarea_id::TEXT)
WHERE modulo IS NULL OR modulo = 'tareas';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alertas_modulo_check'
      AND conrelid = 'public.alertas'::regclass
  ) THEN
    ALTER TABLE public.alertas
      ADD CONSTRAINT alertas_modulo_check CHECK (modulo IN ('tareas', 'reuniones', 'sistema'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alertas_modulo_referencia
  ON public.alertas(modulo, referencia_id);

CREATE INDEX IF NOT EXISTS idx_alertas_destinatario_modulo_leida
  ON public.alertas(destinatario_usuario_id, modulo, leida, created_at DESC);
