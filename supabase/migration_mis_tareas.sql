-- MIGRACION: tareas personales por usuario
-- Mantiene los pendientes privados separados de las tareas oficiales del organismo.

CREATE TABLE IF NOT EXISTS public.mis_tareas (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL CHECK (char_length(trim(titulo)) BETWEEN 1 AND 180),
  descripcion   TEXT,
  fecha         DATE,
  completada    BOOLEAN NOT NULL DEFAULT false,
  completada_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mis_tareas_usuario_estado_fecha
  ON public.mis_tareas(usuario_id, completada, fecha NULLS LAST, created_at DESC);

ALTER TABLE public.mis_tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mis_tareas_select_owner" ON public.mis_tareas;
DROP POLICY IF EXISTS "mis_tareas_insert_owner" ON public.mis_tareas;
DROP POLICY IF EXISTS "mis_tareas_update_owner" ON public.mis_tareas;
DROP POLICY IF EXISTS "mis_tareas_delete_owner" ON public.mis_tareas;

CREATE POLICY "mis_tareas_select_owner" ON public.mis_tareas
FOR SELECT
USING (usuario_id = auth.uid());

CREATE POLICY "mis_tareas_insert_owner" ON public.mis_tareas
FOR INSERT
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "mis_tareas_update_owner" ON public.mis_tareas
FOR UPDATE
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "mis_tareas_delete_owner" ON public.mis_tareas
FOR DELETE
USING (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_mis_tareas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.completada_at = CASE
    WHEN NEW.completada = true AND COALESCE(OLD.completada, false) = false THEN NOW()
    WHEN NEW.completada = false THEN NULL
    ELSE NEW.completada_at
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mis_tareas_updated_at ON public.mis_tareas;
CREATE TRIGGER trg_mis_tareas_updated_at
BEFORE UPDATE ON public.mis_tareas
FOR EACH ROW
EXECUTE FUNCTION public.set_mis_tareas_updated_at();
