import { z } from 'zod'

export type PublicEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().trim().min(1),
})

export function parsePublicEnv(input: Record<string, unknown>): PublicEnv {
  const result = publicEnvSchema.safeParse(input)

  if (!result.success) {
    throw new Error('Configuração pública inválida')
  }

  return {
    supabaseUrl: result.data.VITE_SUPABASE_URL,
    supabaseAnonKey: result.data.VITE_SUPABASE_ANON_KEY,
  }
}
