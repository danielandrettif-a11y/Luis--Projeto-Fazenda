import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/router'
import { SupabaseAuthGateway } from '@/features/auth/supabase-auth-gateway'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { SupabaseFarmGateway } from '@/features/farms/supabase-farm-gateway'
import { parsePublicEnv } from '@/shared/config/public-env'
import { createSupabaseBrowserClient } from '@/shared/lib/supabase-client'
import '@/styles/globals.css'

const publicEnv = parsePublicEnv(import.meta.env)
const supabaseClient = createSupabaseBrowserClient(publicEnv)
const authGateway = new SupabaseAuthGateway(supabaseClient)
const farmGateway = new SupabaseFarmGateway(supabaseClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider gateway={authGateway}>
      <BrowserRouter>
        <AppRoutes farmGateway={farmGateway} />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
