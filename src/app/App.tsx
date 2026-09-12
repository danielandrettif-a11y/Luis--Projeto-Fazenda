import type { AuthUser } from '@/features/auth/auth-gateway'

type AppProps = {
  user?: AuthUser
  onSignOut?: () => Promise<void>
}

export function App({ user, onSignOut }: AppProps = {}) {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão da Fazenda</h1>
          {user && <p className="mt-1 text-sm text-slate-600">{user.email}</p>}
        </div>
        {onSignOut && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium"
            onClick={() => void onSignOut()}
          >
            Sair
          </button>
        )}
      </header>
    </main>
  )
}
