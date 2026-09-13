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

  test('rejects an invalid Supabase URL', () => {
    expect(() => parsePublicEnv({
      VITE_SUPABASE_URL: 'not-a-url',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key',
    })).toThrow('Configuração pública inválida')
  })

  test('rejects an anonymous key containing only spaces', () => {
    expect(() => parsePublicEnv({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: '   ',
    })).toThrow('Configuração pública inválida')
  })

  test('does not expose received values in validation errors', () => {
    const sensitiveKey = 'sensitive-anon-key'
    const parse = () => parsePublicEnv({
      VITE_SUPABASE_URL: 'not-a-url',
      VITE_SUPABASE_ANON_KEY: sensitiveKey,
    })

    expect(parse).toThrow('Configuração pública inválida')
    let message = ''

    try {
      parse()
    } catch (error) {
      message = (error as Error).message
    }

    expect(message).toBe('Configuração pública inválida')
    expect(message).not.toContain(sensitiveKey)
  })
})
