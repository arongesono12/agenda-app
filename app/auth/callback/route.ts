import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function safeNextPath(value: string | null) {
  return value === '/actualizar-password' ? value : '/actualizar-password'
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const destination = new URL(safeNextPath(requestUrl.searchParams.get('next')), requestUrl.origin)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    destination.searchParams.set('error', 'invalid_link')
    return NextResponse.redirect(destination)
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Password recovery code exchange failed:', error.message)
    destination.searchParams.set('error', 'expired_link')
  }

  return NextResponse.redirect(destination)
}
