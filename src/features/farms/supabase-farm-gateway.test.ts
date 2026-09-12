import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SupabaseFarmGateway } from './supabase-farm-gateway'

function createTestClient() {
  return createClient('https://example.supabase.co', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

afterEach(() => vi.restoreAllMocks())

describe('SupabaseFarmGateway', () => {
  test('maps protected farm rows to the application contract', async () => {
    const client = createTestClient()
    vi.spyOn(client, 'from').mockImplementation(((table: string) => {
      if (table !== 'farms') throw new Error(`unexpected table: ${table}`)
      return {
        select(columns: string) {
          if (columns !== 'id, account_id, name, gestation_days') {
            throw new Error(`unexpected columns: ${columns}`)
          }
          return {
            order(column: string) {
              if (column !== 'name') throw new Error(`unexpected ordering: ${column}`)
              return Promise.resolve({
                data: [
                  {
                    id: 'farm-1',
                    account_id: 'account-1',
                    name: 'Sede',
                    gestation_days: 283,
                  },
                ],
                error: null,
                count: null,
                status: 200,
                statusText: 'OK',
              })
            },
          }
        },
      }
    }) as never)

    const farms = await new SupabaseFarmGateway(client).listFarms()

    expect(farms).toEqual([
      { id: 'farm-1', accountId: 'account-1', name: 'Sede', gestationDays: 283 },
    ])
  })

  test('maps bootstrap RPC identifiers to the application contract', async () => {
    const client = createTestClient()
    vi.spyOn(client, 'rpc').mockImplementation(((name: string, input: Record<string, unknown>) => {
      if (name !== 'bootstrap_account') throw new Error(`unexpected RPC: ${name}`)
      if (input.account_name !== 'Fazenda Boa Vista' || input.farm_name !== 'Sede') {
        throw new Error('unexpected RPC input')
      }
      return Promise.resolve({
        data: [{ account_id: 'account-1', farm_id: 'farm-1' }],
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      })
    }) as never)

    const result = await new SupabaseFarmGateway(client).bootstrapAccount({
      accountName: 'Fazenda Boa Vista',
      firstFarmName: 'Sede',
    })

    expect(result).toEqual({ accountId: 'account-1', farmId: 'farm-1' })
  })

  test('rejects a protected farm query failure without returning partial data', async () => {
    const client = createTestClient()
    vi.spyOn(client, 'from').mockReturnValue({
      select() {
        return {
          order() {
            return Promise.resolve({
              data: null,
              error: { message: 'row policy failure', details: '', hint: '', code: '42501' },
              count: null,
              status: 403,
              statusText: 'Forbidden',
            })
          },
        }
      },
    } as never)

    const attempt = new SupabaseFarmGateway(client).listFarms()

    await expect(attempt).rejects.toThrow()
  })
})
