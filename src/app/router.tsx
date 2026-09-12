import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuth } from '@/features/auth/AuthProvider'
import { App } from './App'

function LoadingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center" role="status">
      Carregando…
    </main>
  )
}

function LoginRoute() {
  const { authState } = useAuth()

  if (authState.status === 'loading') return <LoadingPage />
  if (authState.status === 'authenticated') return <Navigate to="/app" replace />
  return <LoginPage />
}

function ProtectedApplicationRoute() {
  const { authState, signOut } = useAuth()

  if (authState.status === 'loading') return <LoadingPage />
  if (authState.status === 'anonymous') return <Navigate to="/entrar" replace />

  return <App user={authState.user} onSignOut={signOut} />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/entrar" element={<LoginRoute />} />
      <Route path="/app" element={<ProtectedApplicationRoute />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
