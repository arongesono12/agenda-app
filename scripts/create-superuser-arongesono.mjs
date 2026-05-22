import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TARGET_EMAIL = 'arongesono@outlook.es'
const TARGET_PASSWORD = 'S@torujjk12me'
const TARGET_NAME = 'Superusuario'
const TARGET_ROLE = 'superusuario'

function readEnvFiles() {
  const env = {}

  for (const file of ['.env', '.env.local']) {
    if (!fs.existsSync(file)) continue

    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (!match) continue

      env[match[1]] = match[2].replace(/^"|"$/g, '')
    }
  }

  return env
}

async function findAuthUserByEmail(admin, email) {
  const normalizedEmail = email.toLowerCase()
  const perPage = 1000
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = (data.users ?? []).find((user) => user.email?.toLowerCase() === normalizedEmail)
    if (match) return match
    if (!data.users || data.users.length < perPage) return null

    page += 1
  }
}

async function main() {
  const env = readEnvFiles()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { error: roleUpsertError } = await admin
    .from('tipos_usuario')
    .upsert(
      {
        codigo: TARGET_ROLE,
        nombre: 'Superusuario',
        descripcion: 'Gestion global de organismos, pagos y administradores.',
      },
      { onConflict: 'codigo' }
    )

  if (roleUpsertError) throw roleUpsertError

  const { data: role, error: roleError } = await admin
    .from('tipos_usuario')
    .select('id, codigo, nombre')
    .eq('codigo', TARGET_ROLE)
    .single()

  if (roleError) throw roleError

  const existingUser = await findAuthUserByEmail(admin, TARGET_EMAIL)
  let authUser = existingUser
  let authAction = 'updated'

  if (existingUser) {
    const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
      password: TARGET_PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        full_name: TARGET_NAME,
      },
    })

    if (error) throw error
    authUser = data.user
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TARGET_EMAIL,
      password: TARGET_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: TARGET_NAME,
      },
    })

    if (error) throw error
    authUser = data.user
    authAction = 'created'
  }

  if (!authUser) throw new Error('No se pudo crear o actualizar el usuario auth.')

  const { data: profile, error: profileError } = await admin
    .from('perfiles_usuario')
    .upsert(
      {
        id: authUser.id,
        email: TARGET_EMAIL,
        nombre_completo: TARGET_NAME,
        tipo_usuario_id: role.id,
      },
      { onConflict: 'id' }
    )
    .select('id, email, tipo_usuario_id')
    .single()

  if (profileError) throw profileError

  const { error: membershipCleanupError } = await admin
    .from('organismo_miembros')
    .delete()
    .eq('usuario_id', authUser.id)

  if (membershipCleanupError) throw membershipCleanupError

  console.log(JSON.stringify({
    ok: true,
    authAction,
    email: TARGET_EMAIL,
    role: role.codigo,
    profileId: profile.id,
    organismMemberships: 0,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
