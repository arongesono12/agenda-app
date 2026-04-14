import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const DEFAULT_USERS = [
  { email: 'dnguema@segesa.gq', password: 'Malabo1234gt' },
  { email: 'mcarmenondo@segesa.gq', password: 'Eligui2011' },
]

function readBootstrapToken(request: Request) {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-bootstrap-token')?.trim() ?? ''
}

export async function POST(request: Request) {
  const expectedToken = process.env.AGENDA_BOOTSTRAP_TOKEN?.trim()

  if (!expectedToken) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Falta configurar AGENDA_BOOTSTRAP_TOKEN en el entorno.',
      },
      { status: 503 }
    )
  }

  const providedToken = readBootstrapToken(request)

  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Token de bootstrap inválido.',
      },
      { status: 401 }
    )
  }

  try {
    const admin = createAdminSupabaseClient()
    const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })

    if (listError) {
      throw listError
    }

    const existingByEmail = new Map(
      (listedUsers.users ?? []).map((user) => [user.email?.toLowerCase(), user])
    )

    const results: Array<{ email: string; action: 'created' | 'updated' }> = []

    for (const targetUser of DEFAULT_USERS) {
      const existing = existingByEmail.get(targetUser.email.toLowerCase())

      if (existing) {
        const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
          password: targetUser.password,
          email_confirm: true,
        })

        if (updateError) {
          throw updateError
        }

        results.push({ email: targetUser.email, action: 'updated' })
        continue
      }

      const { error: createError } = await admin.auth.admin.createUser({
        email: targetUser.email,
        password: targetUser.password,
        email_confirm: true,
      })

      if (createError) {
        throw createError
      }

      results.push({ email: targetUser.email, action: 'created' })
    }

    return NextResponse.json({
      ok: true,
      users: results,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo provisionar los usuarios.',
      },
      { status: 500 }
    )
  }
}
