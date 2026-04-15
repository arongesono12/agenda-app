-- ============================================================
-- ASIGNACION DE TIPOS DE USUARIO A USUARIOS EXISTENTES
-- Ejecutar despues de migration_user_profiles.sql
-- ============================================================

-- Asegura que existan los tipos requeridos para esta asignacion.
INSERT INTO tipos_usuario (codigo, nombre, descripcion)
VALUES
  ('administrador', 'Administrador', 'Gestion completa del sistema.'),
  ('administradora', 'Administradora', 'Gestion completa del sistema.')
ON CONFLICT (codigo) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;

-- Asigna el tipo "Administrador" a dnguema@segesa.gq
UPDATE perfiles_usuario
SET
  tipo_usuario_id = (
    SELECT id
    FROM tipos_usuario
    WHERE codigo = 'administrador'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE email = 'dnguema@segesa.gq';

-- Asigna el tipo "Administradora" a mcarmenondo@segesa.gq
UPDATE perfiles_usuario
SET
  tipo_usuario_id = (
    SELECT id
    FROM tipos_usuario
    WHERE codigo = 'administradora'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE email = 'mcarmenondo@segesa.gq';

-- Verificacion rapida
SELECT
  pu.email,
  pu.nombre_completo,
  tu.codigo AS tipo_codigo,
  tu.nombre AS tipo_nombre
FROM perfiles_usuario pu
LEFT JOIN tipos_usuario tu ON tu.id = pu.tipo_usuario_id
WHERE pu.email IN ('dnguema@segesa.gq', 'mcarmenondo@segesa.gq')
ORDER BY pu.email;
