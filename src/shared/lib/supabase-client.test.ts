import { createClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'
import { createSupabaseBrowserClient } from './supabase-client'

test('creates a browser client for the configured project', () => {
  const received: unknown[] = []

  const client = createSupabaseBrowserClient({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-anon-key',
  }, (url, anonKey, options) => {
    received.push(url, anonKey, options)
    return createClient(url, anonKey, options)
  })

  expect(Reflect.get(client, 'supabaseUrl')).toBe('https://project.supabase.co')
  expect(received).toEqual([
    'https://project.supabase.co',
    'public-anon-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  ])
})
