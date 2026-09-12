import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthError, type AuthGateway, type AuthState, type AuthUser } from './auth-gateway'

export type AuthContextValue = {
  authState: AuthState
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function stateFor(user: AuthUser | null): AuthState {
  return user ? { status: 'authenticated', user } : { status: 'anonymous' }
}

export function AuthProvider({ gateway, children }: { gateway: AuthGateway; children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    let receivedAuthEvent = false

    const unsubscribe = gateway.onAuthStateChange((user) => {
      receivedAuthEvent = true
      if (active) setAuthState(stateFor(user))
    })

    void gateway
      .getCurrentUser()
      .then((user) => {
        if (active && !receivedAuthEvent) setAuthState(stateFor(user))
      })
      .catch(() => {
        if (active && !receivedAuthEvent) setAuthState({ status: 'anonymous' })
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [gateway])

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      async signIn(email, password) {
        try {
          const user = await gateway.signIn(email, password)
          setAuthState({ status: 'authenticated', user })
        } catch (error) {
          if (error instanceof AuthError) throw error
          throw new AuthError('sign_in_failed')
        }
      },
      async signOut() {
        await gateway.signOut()
        setAuthState({ status: 'anonymous' })
      },
    }),
    [authState, gateway],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// The hook intentionally shares this module with its provider as one public boundary.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
