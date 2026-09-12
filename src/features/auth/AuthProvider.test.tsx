import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test } from 'vitest'
import type { AuthGateway, AuthUser } from './auth-gateway'
import { AuthProvider, useAuth } from './AuthProvider'

afterEach(cleanup)

class InMemoryAuthGateway implements AuthGateway {
  private listeners = new Set<(user: AuthUser | null) => void>()

  constructor(
    private currentUser: AuthUser | null,
    private initialUser: Promise<AuthUser | null> = Promise.resolve(currentUser),
  ) {}

  getCurrentUser() {
    return this.initialUser
  }

  async signIn(email: string) {
    this.currentUser = { id: 'user-1', email }
    this.emit(this.currentUser)
    return this.currentUser
  }

  async signOut() {
    this.currentUser = null
    this.emit(null)
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(user: AuthUser | null) {
    this.currentUser = user
    for (const listener of this.listeners) listener(user)
  }
}

function Consumer() {
  const { authState, signOut } = useAuth()

  if (authState.status === 'loading') return <p>Carregando</p>
  if (authState.status === 'anonymous') return <p>Visitante</p>

  return (
    <div>
      <p>{authState.user.email}</p>
      <button type="button" onClick={() => void signOut()}>
        Sair
      </button>
    </div>
  )
}

function renderProvider(gateway: AuthGateway, children: ReactNode = <Consumer />) {
  return render(<AuthProvider gateway={gateway}>{children}</AuthProvider>)
}

describe('AuthProvider', () => {
  test('keeps consumers in loading state until the initial session resolves', async () => {
    let resolveInitial!: (user: AuthUser | null) => void
    const initialUser = new Promise<AuthUser | null>((resolve) => {
      resolveInitial = resolve
    })

    renderProvider(new InMemoryAuthGateway(null, initialUser))

    expect(screen.getByText('Carregando')).toBeInTheDocument()

    await act(async () => resolveInitial(null))

    expect(screen.getByText('Visitante')).toBeInTheDocument()
  })

  test('shows the anonymous state when there is no current user', async () => {
    renderProvider(new InMemoryAuthGateway(null))

    expect(await screen.findByText('Visitante')).toBeInTheDocument()
  })

  test('shows the authenticated identity and follows session changes', async () => {
    const gateway = new InMemoryAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' })
    renderProvider(gateway)

    expect(await screen.findByText('ana@fazenda.com')).toBeInTheDocument()

    act(() => gateway.emit({ id: 'user-2', email: 'luis@fazenda.com' }))

    expect(screen.getByText('luis@fazenda.com')).toBeInTheDocument()
  })

  test('returns consumers to the anonymous state after sign-out', async () => {
    const user = userEvent.setup()
    renderProvider(new InMemoryAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' }))

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByText('Visitante')).toBeInTheDocument()
  })
})
