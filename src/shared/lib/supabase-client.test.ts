import { expect, test } from 'vitest'
import { createSupabaseBrowserClient } from './supabase-client'

test('creates a browser client for the configured project', () => {
  const client = createSupabaseBrowserClient({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-anon-key',
  })

  expect(Reflect.get(client, 'supabaseUrl')).toBe('https://project.supabase.co')
})
