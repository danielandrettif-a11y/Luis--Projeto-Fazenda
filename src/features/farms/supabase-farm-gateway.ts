import type { SupabaseClient } from '@supabase/supabase-js'
import type { BootstrapAccountInput, FarmGateway, FarmSummary } from './farm-gateway'

type FarmRow = {
  id: string
  account_id: string
  name: string
  gestation_days: number
}

type BootstrapRow = {
  account_id: string
  farm_id: string
}

export class SupabaseFarmGateway implements FarmGateway {
  constructor(private readonly client: SupabaseClient) {}

  async listFarms(): Promise<FarmSummary[]> {
    const { data, error } = await this.client
      .from('farms')
      .select('id, account_id, name, gestation_days')
      .order('name')

    if (error) throw error

    return ((data ?? []) as FarmRow[]).map((farm) => ({
      id: farm.id,
      accountId: farm.account_id,
      name: farm.name,
      gestationDays: farm.gestation_days,
    }))
  }

  async bootstrapAccount(
    input: BootstrapAccountInput,
  ): Promise<{ accountId: string; farmId: string }> {
    const { data, error } = await this.client.rpc('bootstrap_account', {
      account_name: input.accountName,
      farm_name: input.firstFarmName,
    })

    if (error) throw error

    const result = (data as BootstrapRow[] | null)?.[0]
    if (!result) throw new Error('bootstrap_account returned no result')

    return { accountId: result.account_id, farmId: result.farm_id }
  }
}
