import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PublicEnv } from '../config/public-env'

export type SupabaseBrowserClientFactory = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  options: {
    auth: {
      persistSession: true
      autoRefreshToken: true
      detectSessionInUrl: true
    }
  },
) => SupabaseClient

export function createSupabaseBrowserClient(
  env: PublicEnv,
  createBrowserClient: SupabaseBrowserClientFactory = createClient,
): SupabaseClient {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
