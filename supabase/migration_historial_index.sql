-- ============================================================
-- MIGRACIÓN: Índice para historial por tarea
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Índice para búsquedas rápidas de historial filtradas por tarea_id
CREATE INDEX IF NOT EXISTS idx_historial_tarea_id ON historial(tarea_id);
