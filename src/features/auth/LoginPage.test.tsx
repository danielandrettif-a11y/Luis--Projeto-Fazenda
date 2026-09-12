import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import { AuthError, type AuthGateway, type AuthUser } from './auth-gateway'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'

afterEach(cleanup)

class LoginAuthGateway implements AuthGateway {
  private listeners = new Set<(user: AuthUser | null) => void>()

  constructor(
    private failure?: unknown,
    private signInResult?: Promise<AuthUser>,
  ) {}

  async getCurrentUser() {
    return null
  }

  async signIn(email: string, password: string) {
    if (this.failure) throw this.failure
    if (this.signInResult) return this.signInResult
    if (email !== 'ana@fazenda.com' || password !== 'segredo-forte') {
      throw new AuthError('invalid_credentials')
    }
    const user = { id: 'user-1', email }
    for (const listener of this.listeners) listener(user)
    return user
  }

  async signOut() {}

  onAuthStateChange(listener: (user: AuthUser | null) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

function renderLogin(gateway: AuthGateway) {
  return render(
    <AuthProvider gateway={gateway}>
      <MemoryRouter initialEntries={['/entrar']}>
        <Routes>
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/app" element={<h1>Área da fazenda</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('LoginPage', () => {
  test('validates email and password before attempting login', async () => {
    const user = userEvent.setup()
    renderLogin(new LoginAuthGateway())

    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
  })

  test('authenticates with the entered credentials and opens the protected area', async () => {
    const user = userEvent.setup()
    renderLogin(new LoginAuthGateway())

    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com')
    await user.type(screen.getByLabelText('Senha'), 'segredo-forte')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Área da fazenda' })).toBeInTheDocument()
  })

  test('shows a stable invalid-credentials error without exposing the password', async () => {
    const user = userEvent.setup()
    renderLogin(new LoginAuthGateway(new AuthError('invalid_credentials')))

    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-incorreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    expect(screen.queryByText('senha-incorreta')).not.toBeInTheDocument()
  })

  test('sanitizes unexpected gateway failures', async () => {
    const user = userEvent.setup()
    renderLogin(new LoginAuthGateway(new Error('backend details: token=secret')))

    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com')
    await user.type(screen.getByLabelText('Senha'), 'segredo-forte')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível entrar. Tente novamente.',
    )
    expect(screen.queryByText(/backend details|token=secret/i)).not.toBeInTheDocument()
  })

  test('disables submission while authentication is pending', async () => {
    const user = userEvent.setup()
    const pending = new Promise<AuthUser>(() => undefined)
    renderLogin(new LoginAuthGateway(undefined, pending))

    await user.type(screen.getByLabelText('E-mail'), 'ana@fazenda.com')
    await user.type(screen.getByLabelText('Senha'), 'segredo-forte')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
  })
})
