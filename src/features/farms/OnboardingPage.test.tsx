import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import type { BootstrapAccountInput, FarmGateway, FarmSummary } from './farm-gateway'
import { OnboardingPage } from './OnboardingPage'

afterEach(cleanup)

class InMemoryFarmGateway implements FarmGateway {
  private farms: FarmSummary[] = []

  constructor(
    private readonly bootstrapResult: Promise<{ accountId: string; farmId: string }> | null = null,
    private readonly failure?: unknown,
  ) {}

  async listFarms() {
    return this.farms
  }

  async bootstrapAccount(input: BootstrapAccountInput) {
    if (this.failure) throw this.failure
    if (this.bootstrapResult) return this.bootstrapResult

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

function renderOnboarding(gateway: FarmGateway) {
  return render(
    <MemoryRouter initialEntries={['/configuracao-inicial']}>
      <Routes>
        <Route path="/configuracao-inicial" element={<OnboardingPage gateway={gateway} />} />
        <Route path="/app" element={<h1>Painel da fazenda</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OnboardingPage', () => {
  test('shows the account and first farm fields', () => {
    renderOnboarding(new InMemoryFarmGateway())

    expect(screen.getByLabelText('Nome da conta')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da fazenda')).toBeInTheDocument()
  })

  test('opens the farm dashboard after creating an account', async () => {
    const user = userEvent.setup()
    renderOnboarding(new InMemoryFarmGateway())

    await user.type(screen.getByLabelText('Nome da conta'), 'Fazenda Boa Vista')
    await user.type(screen.getByLabelText('Nome da fazenda'), 'Sede')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('heading', { name: 'Painel da fazenda' })).toBeInTheDocument()
  })

  test('disables duplicate submission while account creation is pending', async () => {
    const user = userEvent.setup()
    const pending = new Promise<{ accountId: string; farmId: string }>(() => undefined)
    renderOnboarding(new InMemoryFarmGateway(pending))

    await user.type(screen.getByLabelText('Nome da conta'), 'Fazenda Boa Vista')
    await user.type(screen.getByLabelText('Nome da fazenda'), 'Sede')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(screen.getByRole('button', { name: 'Criando…' })).toBeDisabled()
  })

  test('shows a stable failure without clearing the entered values', async () => {
    const user = userEvent.setup()
    renderOnboarding(new InMemoryFarmGateway(null, new Error('database detail: token=secret')))

    await user.type(screen.getByLabelText('Nome da conta'), 'Fazenda Boa Vista')
    await user.type(screen.getByLabelText('Nome da fazenda'), 'Sede')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível criar a conta. Tente novamente.',
    )
    expect(screen.getByLabelText('Nome da conta')).toHaveValue('Fazenda Boa Vista')
    expect(screen.getByLabelText('Nome da fazenda')).toHaveValue('Sede')
    expect(screen.queryByText(/database detail|token=secret/i)).not.toBeInTheDocument()
  })
})
