-- =============================================================================
-- MIGRACION: soporte inicial para pagos por transferencia bancaria
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.organismo_facturas
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
  ADD COLUMN IF NOT EXISTS referencia_pago TEXT,
  ADD COLUMN IF NOT EXISTS notas_pago TEXT;

ALTER TABLE public.organismo_suscripciones
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
  ADD COLUMN IF NOT EXISTS referencia_pago TEXT;

CREATE INDEX IF NOT EXISTS idx_organismo_facturas_referencia_pago
  ON public.organismo_facturas(referencia_pago);

CREATE INDEX IF NOT EXISTS idx_organismo_suscripciones_referencia_pago
  ON public.organismo_suscripciones(referencia_pago);
