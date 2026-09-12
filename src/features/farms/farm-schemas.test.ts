import { describe, expect, test } from 'vitest'
import { bootstrapAccountSchema } from './farm-schemas'

describe('bootstrapAccountSchema', () => {
  test('trims the account name', () => {
    const result = bootstrapAccountSchema.parse({
      accountName: '  Fazenda Boa Vista  ',
      firstFarmName: 'Sede',
    })

    expect(result.accountName).toBe('Fazenda Boa Vista')
  })

  test('trims the first farm name', () => {
    const result = bootstrapAccountSchema.parse({
      accountName: 'Fazenda Boa Vista',
      firstFarmName: '  Sede  ',
    })

    expect(result.firstFarmName).toBe('Sede')
  })

  test('rejects a blank account name with a stable message', () => {
    const result = bootstrapAccountSchema.safeParse({ accountName: '   ', firstFarmName: 'Sede' })

    expect(result.error?.issues[0]?.message).toBe('Informe o nome da conta.')
  })

  test('rejects a one-character account name', () => {
    const result = bootstrapAccountSchema.safeParse({ accountName: 'A', firstFarmName: 'Sede' })

    expect(result.success).toBe(false)
  })

  test('rejects an account name longer than 120 characters', () => {
    const result = bootstrapAccountSchema.safeParse({
      accountName: 'A'.repeat(121),
      firstFarmName: 'Sede',
    })

    expect(result.success).toBe(false)
  })

  test('rejects a blank first farm name with a stable message', () => {
    const result = bootstrapAccountSchema.safeParse({
      accountName: 'Fazenda Boa Vista',
      firstFarmName: '   ',
    })

    expect(result.error?.issues[0]?.message).toBe('Informe o nome da fazenda.')
  })

  test('rejects a one-character first farm name', () => {
    const result = bootstrapAccountSchema.safeParse({
      accountName: 'Fazenda Boa Vista',
      firstFarmName: 'S',
    })

    expect(result.success).toBe(false)
  })

  test('rejects a first farm name longer than 120 characters', () => {
    const result = bootstrapAccountSchema.safeParse({
      accountName: 'Fazenda Boa Vista',
      firstFarmName: 'S'.repeat(121),
    })

    expect(result.success).toBe(false)
  })
})
