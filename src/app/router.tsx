import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '@/features/auth/LoginPage'
import { useAuth } from '@/features/auth/AuthProvider'
import type { FarmGateway } from '@/features/farms/farm-gateway'
import { FarmDashboardPage } from '@/features/farms/FarmDashboardPage'
import { OnboardingPage } from '@/features/farms/OnboardingPage'

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

function ProtectedApplicationRoute({ children }: { children: ReactNode }) {
  const { authState } = useAuth()

  if (authState.status === 'loading') return <LoadingPage />
  if (authState.status === 'anonymous') return <Navigate to="/entrar" replace />

  return children
}

function ProtectedDashboardRoute({ farmGateway }: { farmGateway: FarmGateway }) {
  const { authState, signOut } = useAuth()

  if (authState.status === 'loading') return <LoadingPage />
  if (authState.status === 'anonymous') return <Navigate to="/entrar" replace />

  return (
    <FarmDashboardPage
      gateway={farmGateway}
      user={authState.user}
      onSignOut={signOut}
    />
  )
}

function ApplicationRouteDefinitions({ farmGateway }: { farmGateway: FarmGateway }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/entrar" element={<LoginRoute />} />
      <Route
        path="/app"
        element={<ProtectedDashboardRoute farmGateway={farmGateway} />}
      />
      <Route
        path="/configuracao-inicial"
        element={
          <ProtectedApplicationRoute>
            <OnboardingPage gateway={farmGateway} />
          </ProtectedApplicationRoute>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

function SessionQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export function AppRoutes({ farmGateway }: { farmGateway: FarmGateway }) {
  const { authState } = useAuth()
  const sessionKey = authState.status === 'authenticated' ? authState.user.id : authState.status

  return (
    <SessionQueryProvider key={sessionKey}>
      <ApplicationRouteDefinitions farmGateway={farmGateway} />
    </SessionQueryProvider>
  )
}
