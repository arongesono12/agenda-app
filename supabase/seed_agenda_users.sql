-- ============================================================
-- SEED: usuarios iniciales para Agenda
-- Ejecutar solo con permisos de administrador del proyecto
-- Nota: Supabase recomienda el Admin API para altas de Auth.
-- Este script sirve como seed SQL controlado para el esquema auth.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  seed_email TEXT;
  seed_password TEXT;
  seed_user_id UUID;
BEGIN
  FOR seed_email, seed_password IN
    SELECT *
    FROM (
      VALUES
        ('dnguema@segesa.gq', 'Malabo1234gt'),
        ('mcarmenondo@segesa.gq', 'Eligui2011')
    ) AS seed_list(email, password)
  LOOP
    SELECT id INTO seed_user_id
    FROM auth.users
    WHERE email = seed_email;

    IF seed_user_id IS NULL THEN
      seed_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        '00000000-0000-0000-0000-000000000000',
        seed_user_id,
        'authenticated',
        'authenticated',
        seed_email,
        crypt(seed_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}'::jsonb,
        NOW(),
        NOW()
      );
    ELSE
      UPDATE auth.users
      SET
        encrypted_password = crypt(seed_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}',
        updated_at = NOW()
      WHERE id = seed_user_id;
    END IF;

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      created_at,
      updated_at
    )
    VALUES (
      seed_user_id,
      seed_user_id,
      jsonb_build_object(
        'sub', seed_user_id::text,
        'email', seed_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      seed_user_id::text,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      identity_data = EXCLUDED.identity_data,
      updated_at = NOW();
  END LOOP;
END $$;
