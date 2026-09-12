import { useState, type ReactNode } from 'react'
import type { AuthUser } from '@/features/auth/auth-gateway'

type AuthenticatedAppShellProps = {
  user: AuthUser
  onSignOut(): Promise<void>
  children: ReactNode
}

export function AuthenticatedAppShell({
  user,
  onSignOut,
  children,
}: AuthenticatedAppShellProps) {
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-green-800">Gestão da Fazenda</p>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <p className="text-sm text-slate-600">{user.email}</p>
            <button
              type="button"
              disabled={isSigningOut}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void handleSignOut()}
            >
              {isSigningOut ? 'Saindo…' : 'Sair'}
            </button>
            {signOutError && (
              <p role="alert" className="basis-full text-sm text-red-700 sm:text-right">
                {signOutError}
              </p>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
