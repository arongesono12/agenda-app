-- ============================================================
-- MIGRACION: preferencias por usuario
-- Ejecutar despues de migration_user_profiles.sql
-- ============================================================

ALTER TABLE perfiles_usuario
ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;
