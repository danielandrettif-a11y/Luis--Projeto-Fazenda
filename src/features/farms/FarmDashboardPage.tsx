import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import type { FarmGateway } from './farm-gateway'

const futureModules = ['Rebanho', 'Reprodução', 'Sanidade', 'Relatórios'] as const

export function FarmDashboardPage({ gateway }: { gateway: FarmGateway }) {
  const farmsQuery = useQuery({
    queryKey: ['farms'],
    queryFn: () => gateway.listFarms(),
  })

  if (farmsQuery.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
        Carregando fazendas…
      </main>
    )
  }

  if (farmsQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Não foi possível carregar as fazendas. Tente novamente.
        </p>
      </main>
    )
  }

  if (farmsQuery.data.length === 0) {
    return <Navigate to="/configuracao-inicial" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-slate-200 bg-white px-4 py-5 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6">
        <p className="text-lg font-bold text-green-800">Gestão da Fazenda</p>
        <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1" aria-label="Módulos da fazenda">
          {futureModules.map((module) => (
            <button
              key={module}
              type="button"
              disabled
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-left text-sm text-slate-500 disabled:cursor-not-allowed"
            >
              <span>{module}</span>
              <span className="text-xs font-medium">Em breve</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="px-4 py-8 sm:px-6 lg:px-10">
        <header className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold text-green-700">Visão geral da conta</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Gestão da Fazenda
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Acompanhe as configurações das fazendas disponíveis para sua conta.
          </p>
        </header>

        <section className="mx-auto mt-8 max-w-6xl" aria-labelledby="farms-title">
          <h2 id="farms-title" className="text-xl font-semibold text-slate-900">
            Fazendas da conta
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {farmsQuery.data.map((farm) => (
              <article
                key={farm.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-slate-900">{farm.name}</h3>
                <p className="mt-3 text-sm text-slate-600">
                  Gestação: {farm.gestationDays} dias
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
