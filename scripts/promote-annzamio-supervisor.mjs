import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TARGET_EMAIL = 'annzamio@segesa.gq'
const TARGET_NAME = 'Angelina Nfumu Nzamio Obono'
const TARGET_ROLE = 'supervisor'

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

  const { data: role, error: roleError } = await admin
    .from('tipos_usuario')
    .select('id, codigo, nombre')
    .eq('codigo', TARGET_ROLE)
    .maybeSingle()

  if (roleError) throw roleError
  if (!role) throw new Error('No existe el rol supervisor.')

  const { data: existingProfile, error: profileLookupError } = await admin
    .from('perfiles_usuario')
    .select('id, email, nombre_completo')
    .eq('email', TARGET_EMAIL)
    .maybeSingle()

  if (profileLookupError) throw profileLookupError

  let profile = existingProfile

  if (!profile) {
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (usersError) throw usersError

    const authUser = (users.users ?? []).find((user) => user.email?.toLowerCase() === TARGET_EMAIL)
    if (!authUser) throw new Error(`No existe usuario auth para ${TARGET_EMAIL}.`)

    const { data: insertedProfile, error: insertProfileError } = await admin
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
      .select('id, email, nombre_completo')
      .single()

    if (insertProfileError) throw insertProfileError
    profile = insertedProfile
  } else {
    const { data: updatedProfile, error: updateProfileError } = await admin
      .from('perfiles_usuario')
      .update({ tipo_usuario_id: role.id })
      .eq('id', profile.id)
      .select('id, email, nombre_completo')
      .single()

    if (updateProfileError) throw updateProfileError
    profile = updatedProfile
  }

  let { data: responsable, error: responsableByEmailError } = await admin
    .from('responsables')
    .select('id, nombre, email, usuario_id, cargo, departamento')
    .eq('email', TARGET_EMAIL)
    .maybeSingle()

  if (responsableByEmailError) throw responsableByEmailError

  if (!responsable) {
    const { data: responsableByName, error: responsableByNameError } = await admin
      .from('responsables')
      .select('id, nombre, email, usuario_id, cargo, departamento')
      .eq('nombre', TARGET_NAME)
      .maybeSingle()

    if (responsableByNameError) throw responsableByNameError
    responsable = responsableByName
  }

  if (!responsable) {
    throw new Error(`No existe responsable para ${TARGET_NAME}.`)
  }

  const { data: updatedResponsable, error: updateResponsableError } = await admin
    .from('responsables')
    .update({
      usuario_id: profile.id,
      cargo: 'Supervisor',
    })
    .eq('id', responsable.id)
    .select('id, nombre, email, usuario_id, cargo, departamento')
    .single()

  if (updateResponsableError) throw updateResponsableError

  console.log(JSON.stringify({
    ok: true,
    email: TARGET_EMAIL,
    role: role.codigo,
    profileId: profile.id,
    responsable: {
      id: updatedResponsable.id,
      nombre: updatedResponsable.nombre,
      email: updatedResponsable.email,
      cargo: updatedResponsable.cargo,
      departamento: updatedResponsable.departamento,
      usuario_id: updatedResponsable.usuario_id,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
