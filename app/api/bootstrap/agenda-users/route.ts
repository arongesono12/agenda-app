import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

type BootstrapUser = {
  email: string
  password: string
}

function readBootstrapUsers(): BootstrapUser[] {
  const raw = process.env.AGENDA_BOOTSTRAP_USERS?.trim()

  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as BootstrapUser[]
    return parsed.filter(
      (entry) =>
        typeof entry?.email === 'string' &&
        entry.email.trim() &&
        typeof entry?.password === 'string' &&
        entry.password.length >= 8
    )
  } catch {
    return []
  }
}

function readBootstrapToken(request: Request) {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-bootstrap-token')?.trim() ?? ''
}

function isBootstrapEnabled() {
  if (process.env.NODE_ENV !== 'production') return true
  return process.env.AGENDA_BOOTSTRAP_ENABLED?.trim().toLowerCase() === 'true'
}

function tokenMatches(providedToken: string, expectedToken: string) {
  const provided = Buffer.from(providedToken)
  const expected = Buffer.from(expectedToken)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

function canUpdateExistingPasswords() {
  return process.env.AGENDA_BOOTSTRAP_UPDATE_EXISTING_PASSWORDS?.trim().toLowerCase() === 'true'
}

export async function POST(request: Request) {
  const expectedToken = process.env.AGENDA_BOOTSTRAP_TOKEN?.trim()
  const bootstrapUsers = readBootstrapUsers()

  if (!isBootstrapEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Bootstrap deshabilitado en produccion.',
      },
      { status: 403 }
    )
  }

  if (!expectedToken) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Falta configurar AGENDA_BOOTSTRAP_TOKEN en el entorno.',
      },
      { status: 503 }
    )
  }

  if (bootstrapUsers.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Falta configurar AGENDA_BOOTSTRAP_USERS con un JSON valido de usuarios iniciales.',
      },
      { status: 503 }
    )
  }

  const providedToken = readBootstrapToken(request)

  if (!providedToken || !tokenMatches(providedToken, expectedToken)) {
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
    const updateExistingPasswords = canUpdateExistingPasswords()

    const results: Array<{ email: string; action: 'created' | 'updated' | 'skipped' }> = []

    for (const targetUser of bootstrapUsers) {
      const existing = existingByEmail.get(targetUser.email.toLowerCase())

      if (existing) {
        if (!updateExistingPasswords) {
          results.push({ email: targetUser.email, action: 'skipped' })
          continue
        }

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
