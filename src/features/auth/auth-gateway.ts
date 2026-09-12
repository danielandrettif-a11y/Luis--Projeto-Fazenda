export type AuthUser = {
  id: string
  email: string
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser }

export type AuthStateListener = (user: AuthUser | null) => void

export interface AuthGateway {
  getCurrentUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
  onAuthStateChange(listener: AuthStateListener): () => void
}

export type AuthErrorCode = 'invalid_credentials' | 'sign_in_failed' | 'sign_out_failed'

const authErrorMessages: Record<AuthErrorCode, string> = {
  invalid_credentials: 'E-mail ou senha inválidos.',
  sign_in_failed: 'Não foi possível entrar. Tente novamente.',
  sign_out_failed: 'Não foi possível sair. Tente novamente.',
}

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(authErrorMessages[code])
    this.name = 'AuthError'
  }
}
