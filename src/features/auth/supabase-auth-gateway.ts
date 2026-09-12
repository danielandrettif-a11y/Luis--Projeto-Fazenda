import type { SupabaseClient, User } from '@supabase/supabase-js'
import { AuthError, type AuthGateway, type AuthStateListener, type AuthUser } from './auth-gateway'

function toAuthUser(user: User | null): AuthUser | null {
  return user?.email ? { id: user.id, email: user.email } : null
}

function isInvalidCredentials(error: unknown) {
  if (!(error instanceof Error)) return false
  const details = error as Error & { code?: unknown; status?: unknown }

  return (
    details.code === 'invalid_credentials' ||
    (details.status === 400 && details.message.toLowerCase() === 'invalid login credentials')
  )
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error) return null
    return toAuthUser(data.session?.user ?? null)
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })

    if (error) {
      throw new AuthError(isInvalidCredentials(error) ? 'invalid_credentials' : 'sign_in_failed')
    }

    const user = toAuthUser(data.user)
    if (!user) throw new AuthError('sign_in_failed')
    return user
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw new AuthError('sign_out_failed')
  }

  onAuthStateChange(listener: AuthStateListener): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(toAuthUser(session?.user ?? null))
    })

    return () => data.subscription.unsubscribe()
  }
}
