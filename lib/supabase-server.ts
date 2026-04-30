import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/database.types'

type CookieMutation = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieMutation[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              ;(cookieStore as never as { set: (name: string, value: string, options?: Record<string, unknown>) => void }).set(name, value, options)
            })
          } catch {
            // Server Components cannot always mutate cookies. Middleware handles refresh persistence.
          }
        },
      },
    }
  )
}
