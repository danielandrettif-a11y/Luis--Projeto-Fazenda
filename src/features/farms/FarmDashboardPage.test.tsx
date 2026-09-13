import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import type { FarmGateway, FarmSummary } from './farm-gateway'
import { FarmDashboardPage } from './FarmDashboardPage'

afterEach(cleanup)

class DashboardFarmGateway implements FarmGateway {
  constructor(private readonly farms: FarmSummary[]) {}

  async listFarms() {
    return this.farms
  }

  async bootstrapAccount() {
    return { accountId: 'account-1', farmId: 'farm-1' }
  }
}

class FailingDashboardFarmGateway implements FarmGateway {
  async listFarms(): Promise<FarmSummary[]> {
    throw new Error('database detail: token=secret')
  }

  async bootstrapAccount() {
    return { accountId: 'account-1', farmId: 'farm-1' }
  }
}

const farms: FarmSummary[] = [
  { id: 'farm-1', accountId: 'account-1', name: 'Sede', gestationDays: 283 },
  { id: 'farm-2', accountId: 'account-1', name: 'Retiro Norte', gestationDays: 290 },
]

function renderDashboard(gateway: FarmGateway) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<FarmDashboardPage gateway={gateway} />} />
          <Route path="/configuracao-inicial" element={<h1>Configure sua conta</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FarmDashboardPage', () => {
  test('redirects an account without farms to onboarding', async () => {
    renderDashboard(new DashboardFarmGateway([]))

    expect(await screen.findByRole('heading', { name: 'Configure sua conta' })).toBeInTheDocument()
  })

  test('shows an account-level dashboard heading', async () => {
    renderDashboard(new DashboardFarmGateway(farms))

    expect(await screen.findByRole('heading', { name: 'Gestão da Fazenda' })).toBeInTheDocument()
  })

  test('shows each farm with its configured gestation days', async () => {
    renderDashboard(new DashboardFarmGateway(farms))

    expect(await screen.findByRole('heading', { name: 'Sede' })).toBeInTheDocument()
    expect(screen.getByText('Gestação: 283 dias')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Retiro Norte' })).toBeInTheDocument()
    expect(screen.getByText('Gestação: 290 dias')).toBeInTheDocument()
  })

  test('exposes disabled placeholders for future modules', async () => {
    renderDashboard(new DashboardFarmGateway(farms))

    await screen.findByRole('heading', { name: 'Gestão da Fazenda' })
    expect(screen.getByRole('button', { name: /Rebanho.*Em breve/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Reprodução.*Em breve/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Sanidade.*Em breve/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Relatórios.*Em breve/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Rebanho|Reprodução|Sanidade|Relatórios/ })).not.toBeInTheDocument()
  })

  test('shows a stable error when protected farms cannot be loaded', async () => {
    renderDashboard(new FailingDashboardFarmGateway())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as fazendas. Tente novamente.',
    )
    expect(screen.queryByText(/database detail|token=secret/i)).not.toBeInTheDocument()
  })
})
