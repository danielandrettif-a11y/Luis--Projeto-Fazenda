import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PublicEnv } from '../config/public-env'

export function createSupabaseBrowserClient(env: PublicEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
