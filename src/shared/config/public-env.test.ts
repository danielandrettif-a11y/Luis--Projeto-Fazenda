import { describe, expect, test } from 'vitest'
import { parsePublicEnv } from './public-env'

describe('parsePublicEnv', () => {
  test('maps valid public variables', () => {
    expect(parsePublicEnv({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
    })).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'public-anon-key',
    })
  })

  test('rejects missing variables without exposing values', () => {
    expect(() => parsePublicEnv({})).toThrow('Configuração pública inválida')
  })
})
