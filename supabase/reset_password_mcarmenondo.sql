-- ============================================================
-- SCRIPT: cambiar contrasena de un usuario en Supabase Auth
-- Ejecutar desde el SQL Editor con privilegios de administrador
-- ============================================================

DO $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE email = 'mcarmenondo@segesa.gq'
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con el correo %', 'mcarmenondo@segesa.gq';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt('Eligui2011', gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;
END;
$$;
