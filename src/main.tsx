import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/router'
import { SupabaseAuthGateway } from '@/features/auth/supabase-auth-gateway'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { parsePublicEnv } from '@/shared/config/public-env'
import { createSupabaseBrowserClient } from '@/shared/lib/supabase-client'
import '@/styles/globals.css'

const publicEnv = parsePublicEnv(import.meta.env)
const authGateway = new SupabaseAuthGateway(createSupabaseBrowserClient(publicEnv))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider gateway={authGateway}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
