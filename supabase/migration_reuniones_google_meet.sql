-- Sustituye la integracion de Zoom por Google Meet sin perder los enlaces historicos.

DROP INDEX IF EXISTS public.idx_reuniones_zoom_meeting_id;

ALTER TABLE public.reuniones
  ADD COLUMN IF NOT EXISTS proveedor_reunion TEXT,
  ADD COLUMN IF NOT EXISTS google_meet_space_name TEXT,
  ADD COLUMN IF NOT EXISTS google_meet_code TEXT;

ALTER TABLE public.reuniones
  DROP CONSTRAINT IF EXISTS reuniones_proveedor_reunion_check;

UPDATE public.reuniones
SET proveedor_reunion = 'manual'
WHERE proveedor_reunion = 'zoom';

ALTER TABLE public.reuniones
  DROP COLUMN IF EXISTS zoom_meeting_id,
  DROP COLUMN IF EXISTS zoom_meeting_uuid,
  DROP COLUMN IF EXISTS zoom_start_url,
  DROP COLUMN IF EXISTS zoom_password,
  DROP COLUMN IF EXISTS zoom_host_id;

ALTER TABLE public.reuniones
  ADD CONSTRAINT reuniones_proveedor_reunion_check
  CHECK (proveedor_reunion IS NULL OR proveedor_reunion IN ('manual', 'google_meet'));

CREATE INDEX IF NOT EXISTS idx_reuniones_google_meet_space
  ON public.reuniones(google_meet_space_name)
  WHERE google_meet_space_name IS NOT NULL;

DROP INDEX IF EXISTS public.idx_reuniones_organismo_proveedor_fecha;
CREATE INDEX IF NOT EXISTS idx_reuniones_organismo_proveedor_fecha
  ON public.reuniones(organismo_id, proveedor_reunion, fecha_inicio DESC);
