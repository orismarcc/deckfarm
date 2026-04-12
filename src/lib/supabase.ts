import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy browser client — only instantiated when first needed
let _supabase: SupabaseClient | null | undefined = undefined

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (_supabase !== undefined) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) { _supabase = null; return null }
  _supabase = createClient(url, key)
  return _supabase
}

// Server-side client with service role (always lazy)
export function createServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
