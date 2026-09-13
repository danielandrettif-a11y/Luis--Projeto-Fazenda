import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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
  const authEventRevision = useRef(0)

  useEffect(() => {
    let active = true
    let receivedAuthEvent = false

    const unsubscribe = gateway.onAuthStateChange((user) => {
      receivedAuthEvent = true
      authEventRevision.current += 1
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
        const startingRevision = authEventRevision.current
        try {
          const user = await gateway.signIn(email, password)
          if (authEventRevision.current === startingRevision) {
            setAuthState({ status: 'authenticated', user })
          }
        } catch (error) {
          if (error instanceof AuthError) throw error
          throw new AuthError('sign_in_failed')
        }
      },
      async signOut() {
        const startingRevision = authEventRevision.current
        try {
          await gateway.signOut()
          if (authEventRevision.current === startingRevision) {
            setAuthState({ status: 'anonymous' })
          }
        } catch (error) {
          if (error instanceof AuthError && error.code === 'sign_out_failed') throw error
          throw new AuthError('sign_out_failed')
        }
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
