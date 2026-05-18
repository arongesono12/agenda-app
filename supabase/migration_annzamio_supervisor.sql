-- Promueve a Angelina Nfumu Nzamio Obono / annzamio@segesa.gq a Supervisor.
-- Mantiene el catalogo de responsables vinculado al perfil de usuario.

WITH supervisor_role AS (
  SELECT id
  FROM public.tipos_usuario
  WHERE codigo = 'supervisor'
),
target_profile AS (
  UPDATE public.perfiles_usuario
  SET tipo_usuario_id = (SELECT id FROM supervisor_role)
  WHERE LOWER(email) = 'annzamio@segesa.gq'
  RETURNING id
)
UPDATE public.responsables
SET
  usuario_id = COALESCE(usuario_id, (SELECT id FROM target_profile)),
  cargo = COALESCE(NULLIF(TRIM(cargo), ''), 'Supervisor')
WHERE
  LOWER(email) = 'annzamio@segesa.gq'
  OR LOWER(nombre) = LOWER('Angelina Nfumu Nzamio Obono');
