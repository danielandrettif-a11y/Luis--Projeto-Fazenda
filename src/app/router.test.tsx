import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import type { AuthGateway, AuthUser } from '@/features/auth/auth-gateway'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { AppRoutes } from './router'

afterEach(cleanup)

class RouteAuthGateway implements AuthGateway {
  private listeners = new Set<(user: AuthUser | null) => void>()

  constructor(
    user: AuthUser | null,
    private initialUser = Promise.resolve(user),
    private signOutFailure?: unknown,
  ) {}

  getCurrentUser() {
    return this.initialUser
  }

  async signIn(email: string) {
    const user = { id: 'user-1', email }
    for (const listener of this.listeners) listener(user)
    return user
  }

  async signOut() {
    if (this.signOutFailure) throw this.signOutFailure
    for (const listener of this.listeners) listener(null)
  }

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

function renderRoute(path: string, gateway: AuthGateway) {
  return render(
    <AuthProvider gateway={gateway}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('application routes', () => {
  test('shows a loading branch while the initial authentication is unresolved', () => {
    renderRoute('/app', new RouteAuthGateway(null, new Promise(() => undefined)))

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  test('redirects an anonymous protected visit to the public login page', async () => {
    renderRoute('/app', new RouteAuthGateway(null))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
  })

  test('keeps the login route public for anonymous visitors', async () => {
    renderRoute('/entrar', new RouteAuthGateway(null))

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeEnabled()
    expect(screen.queryByRole('link', { name: /cadastr/i })).not.toBeInTheDocument()
  })

  test('redirects authenticated visitors from login to the protected application', async () => {
    renderRoute(
      '/entrar',
      new RouteAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' }),
    )

    expect(await screen.findByRole('heading', { name: 'Gestão da Fazenda' })).toBeInTheDocument()
    expect(screen.getByText('ana@fazenda.com')).toBeInTheDocument()
  })

  test('signs out from the protected application and returns to login', async () => {
    const user = userEvent.setup()
    renderRoute('/app', new RouteAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' }))

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  test('keeps the authenticated area and allows retry when sign-out fails', async () => {
    const user = userEvent.setup()
    renderRoute(
      '/app',
      new RouteAuthGateway(
        { id: 'user-1', email: 'ana@fazenda.com' },
        undefined,
        new Error('network detail: token=secret'),
      ),
    )

    await user.click(await screen.findByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair. Tente novamente.',
    )
    expect(screen.getByRole('heading', { name: 'Gestão da Fazenda' })).toBeInTheDocument()
    expect(screen.getByText('ana@fazenda.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled()
    expect(screen.queryByText(/network detail|token=secret/i)).not.toBeInTheDocument()
  })
})
