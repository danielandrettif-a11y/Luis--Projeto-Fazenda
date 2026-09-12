import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import type { AuthGateway, AuthUser } from '@/features/auth/auth-gateway'
import { AuthProvider } from '@/features/auth/AuthProvider'
import type {
  BootstrapAccountInput,
  FarmGateway,
  FarmSummary,
} from '@/features/farms/farm-gateway'
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

  replaceAuthenticatedUser(user: AuthUser) {
    for (const listener of this.listeners) listener(user)
  }
}

class RouteFarmGateway implements FarmGateway {
  constructor(private farms: FarmSummary[] = [
    { id: 'farm-1', accountId: 'account-1', name: 'Sede', gestationDays: 283 },
  ]) {}

  async listFarms() {
    return this.farms
  }

  async bootstrapAccount(input: BootstrapAccountInput) {
    const result = { accountId: 'account-1', farmId: 'farm-1' }
    this.farms = [
      {
        id: result.farmId,
        accountId: result.accountId,
        name: input.firstFarmName,
        gestationDays: 283,
      },
    ]
    return result
  }
}

class SessionSwitchFarmGateway implements FarmGateway {
  private pending = false

  startPendingSession() {
    this.pending = true
  }

  async listFarms() {
    if (this.pending) return new Promise<FarmSummary[]>(() => undefined)
    return [{ id: 'farm-1', accountId: 'account-1', name: 'Sede', gestationDays: 283 }]
  }

  async bootstrapAccount() {
    return { accountId: 'account-1', farmId: 'farm-1' }
  }
}

function renderRoute(
  path: string,
  gateway: AuthGateway,
  farmGateway: FarmGateway = new RouteFarmGateway(),
) {
  return render(
    <AuthProvider gateway={gateway}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes farmGateway={farmGateway} />
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
    expect(await screen.findByRole('heading', { name: 'Sede' })).toBeInTheDocument()
  })

  test('redirects an authenticated account without farms to onboarding', async () => {
    renderRoute(
      '/app',
      new RouteAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' }),
      new RouteFarmGateway([]),
    )

    expect(await screen.findByLabelText('Nome da conta')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da fazenda')).toBeInTheDocument()
  })

  test('protects onboarding from anonymous visitors', async () => {
    renderRoute('/configuracao-inicial', new RouteAuthGateway(null), new RouteFarmGateway([]))

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  test('opens the dashboard after initial account setup', async () => {
    const user = userEvent.setup()
    const farmGateway = new RouteFarmGateway([])
    renderRoute(
      '/configuracao-inicial',
      new RouteAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' }),
      farmGateway,
    )

    await user.type(await screen.findByLabelText('Nome da conta'), 'Fazenda Boa Vista')
    await user.type(screen.getByLabelText('Nome da fazenda'), 'Sede Nova')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('heading', { name: 'Sede Nova' })).toBeInTheDocument()
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

  test('does not expose cached farms from a signed-out session', async () => {
    const user = userEvent.setup()
    const farmGateway = new SessionSwitchFarmGateway()
    renderRoute(
      '/app',
      new RouteAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' }),
      farmGateway,
    )

    expect(await screen.findByRole('heading', { name: 'Sede' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sair' }))
    await screen.findByRole('heading', { name: 'Entrar' })
    farmGateway.startPendingSession()

    await user.type(screen.getByLabelText('E-mail'), 'outra@fazenda.com')
    await user.type(screen.getByLabelText('Senha'), 'segredo-forte')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Carregando fazendas…')
    expect(screen.queryByRole('heading', { name: 'Sede' })).not.toBeInTheDocument()
  })

  test('does not expose cached farms when the authenticated user changes directly', async () => {
    const authGateway = new RouteAuthGateway({ id: 'user-1', email: 'ana@fazenda.com' })
    const farmGateway = new SessionSwitchFarmGateway()
    renderRoute('/app', authGateway, farmGateway)

    expect(await screen.findByRole('heading', { name: 'Sede' })).toBeInTheDocument()
    farmGateway.startPendingSession()
    await act(async () => {
      authGateway.replaceAuthenticatedUser({ id: 'user-2', email: 'outra@fazenda.com' })
    })

    expect(screen.getByRole('status')).toHaveTextContent('Carregando fazendas…')
    expect(screen.queryByRole('heading', { name: 'Sede' })).not.toBeInTheDocument()
  })
})
