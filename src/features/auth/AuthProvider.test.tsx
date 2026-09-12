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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

class ControlledAuthGateway implements AuthGateway {
  private listeners = new Set<(user: AuthUser | null) => void>()

  constructor(
    private initialUser: AuthUser | null,
    readonly pendingSignIn = deferred<AuthUser>(),
    readonly pendingSignOut = deferred<void>(),
  ) {}

  async getCurrentUser() {
    return this.initialUser
  }

  signIn() {
    return this.pendingSignIn.promise
  }

  signOut() {
    return this.pendingSignOut.promise
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(user: AuthUser | null) {
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

function OperationsConsumer() {
  const { authState, signIn, signOut } = useAuth()

  return (
    <div>
      <p>
        {authState.status === 'authenticated'
          ? authState.user.email
          : authState.status === 'anonymous'
            ? 'Visitante'
            : 'Carregando'}
      </p>
      <button type="button" onClick={() => void signIn('ana@fazenda.com', 'segredo-forte')}>
        Entrar
      </button>
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

  test('does not let a late sign-in result overwrite newer auth events', async () => {
    const user = userEvent.setup()
    const gateway = new ControlledAuthGateway(null)
    renderProvider(gateway, <OperationsConsumer />)

    await screen.findByText('Visitante')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    act(() => gateway.emit({ id: 'user-2', email: 'outra@fazenda.com' }))
    act(() => gateway.emit(null))
    await act(async () => {
      gateway.pendingSignIn.resolve({ id: 'user-1', email: 'ana@fazenda.com' })
    })

    expect(screen.getByText('Visitante')).toBeInTheDocument()
    expect(screen.queryByText('ana@fazenda.com')).not.toBeInTheDocument()
  })

  test('does not let a late sign-out result overwrite a newer authenticated event', async () => {
    const user = userEvent.setup()
    const gateway = new ControlledAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' })
    renderProvider(gateway, <OperationsConsumer />)

    await user.click(await screen.findByRole('button', { name: 'Sair' }))
    act(() => gateway.emit({ id: 'user-2', email: 'outra@fazenda.com' }))
    await act(async () => gateway.pendingSignOut.resolve())

    expect(screen.getByText('outra@fazenda.com')).toBeInTheDocument()
    expect(screen.queryByText('Visitante')).not.toBeInTheDocument()
  })
})
