import { AuthApiError, createClient, type Session, type User } from '@supabase/supabase-js'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AuthError } from './auth-gateway'
import { SupabaseAuthGateway } from './supabase-auth-gateway'

const user: User = {
  id: 'user-1',
  email: 'ana@fazenda.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2026-09-12T12:00:00.000Z',
}

const session: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user,
}

function createTestClient() {
  return createClient('https://example.supabase.co', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

afterEach(() => vi.restoreAllMocks())

describe('SupabaseAuthGateway', () => {
  test('maps a Supabase session to the minimal application identity', async () => {
    const client = createTestClient()
    vi.spyOn(client.auth, 'getSession').mockResolvedValue({ data: { session }, error: null })

    const result = await new SupabaseAuthGateway(client).getCurrentUser()

    expect(result).toEqual({ id: 'user-1', email: 'ana@fazenda.com' })
    expect(result).not.toHaveProperty('app_metadata')
    expect(result).not.toHaveProperty('access_token')
  })

  test('translates invalid credentials without exposing the Supabase error', async () => {
    const client = createTestClient()
    vi.spyOn(client.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    })

    const attempt = new SupabaseAuthGateway(client).signIn('ana@fazenda.com', 'incorreta')

    await expect(attempt).rejects.toEqual(new AuthError('invalid_credentials'))
  })

  test('translates unexpected sign-in failures to the generic public message', async () => {
    const client = createTestClient()
    vi.spyOn(client.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('internal provider detail', 503, 'unexpected_failure'),
    })

    const attempt = new SupabaseAuthGateway(client).signIn('ana@fazenda.com', 'segredo-forte')

    await expect(attempt).rejects.toEqual(new AuthError('sign_in_failed'))
  })
})
