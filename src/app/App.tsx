import { useState } from 'react'
import type { AuthUser } from '@/features/auth/auth-gateway'

type AppProps = {
  user?: AuthUser
  onSignOut?: () => Promise<void>
}

export function App({ user, onSignOut }: AppProps = {}) {
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    if (!onSignOut) return
    setSignOutError(null)
    setIsSigningOut(true)
    try {
      await onSignOut()
    } catch {
      setSignOutError('Não foi possível sair. Tente novamente.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão da Fazenda</h1>
          {user && <p className="mt-1 text-sm text-slate-600">{user.email}</p>}
        </div>
        {onSignOut && (
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              disabled={isSigningOut}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleSignOut()}
            >
              {isSigningOut ? 'Saindo…' : 'Sair'}
            </button>
            {signOutError && (
              <p role="alert" className="text-sm text-red-700">
                {signOutError}
              </p>
            )}
          </div>
        )}
      </header>
    </main>
  )
}
