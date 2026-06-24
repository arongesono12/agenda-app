-- MIGRACION: integracion de Zoom Meetings en el modulo de reuniones.
-- Ejecutar despues de supabase/migration_reuniones.sql.
--
-- La aplicacion usa Server-to-Server OAuth de Zoom para crear reuniones desde
-- /api/reuniones y guarda el join_url en enlace_reunion para los invitados.
-- zoom_start_url es sensible: solo debe usarse internamente por usuarios con
-- permiso de gestion de reuniones.

ALTER TABLE public.reuniones
  ADD COLUMN IF NOT EXISTS proveedor_reunion TEXT,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_meeting_uuid TEXT,
  ADD COLUMN IF NOT EXISTS zoom_start_url TEXT,
  ADD COLUMN IF NOT EXISTS zoom_password TEXT,
  ADD COLUMN IF NOT EXISTS zoom_host_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reuniones_proveedor_reunion_check'
      AND conrelid = 'public.reuniones'::regclass
  ) THEN
    ALTER TABLE public.reuniones
      ADD CONSTRAINT reuniones_proveedor_reunion_check
      CHECK (proveedor_reunion IS NULL OR proveedor_reunion IN ('manual', 'zoom'));
  END IF;
END $$;

UPDATE public.reuniones
SET proveedor_reunion = 'manual'
WHERE proveedor_reunion IS NULL
  AND enlace_reunion IS NOT NULL
  AND TRIM(enlace_reunion) <> '';

CREATE INDEX IF NOT EXISTS idx_reuniones_zoom_meeting_id
  ON public.reuniones(zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reuniones_proveedor
  ON public.reuniones(organismo_id, proveedor_reunion, fecha_inicio DESC);
