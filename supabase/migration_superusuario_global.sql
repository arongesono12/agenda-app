-- MIGRACION: superusuario global de la plataforma
-- El superusuario gestiona organismos, pagos y administradores desde fuera
-- de los organismos. No debe existir como miembro en organismo_miembros.

BEGIN;

INSERT INTO public.tipos_usuario (codigo, nombre, descripcion)
VALUES (
  'superusuario',
  'Superusuario',
  'Gestion global de organismos, pagos y administradores sin pertenecer a ningun organismo.'
)
ON CONFLICT (codigo) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion;

DROP TRIGGER IF EXISTS trg_sync_superusuarios_to_new_organismo ON public.organismos;
DROP TRIGGER IF EXISTS trg_sync_superusuario_profile_memberships ON public.perfiles_usuario;

DROP FUNCTION IF EXISTS public.sync_superusuarios_to_new_organismo();
DROP FUNCTION IF EXISTS public.sync_superusuario_profile_memberships();
DROP FUNCTION IF EXISTS public.sync_superusuario_memberships();

DELETE FROM public.organismo_miembros om
USING public.perfiles_usuario p
JOIN public.tipos_usuario tu ON tu.id = p.tipo_usuario_id
WHERE om.usuario_id = p.id
  AND tu.codigo = 'superusuario';

COMMIT;
