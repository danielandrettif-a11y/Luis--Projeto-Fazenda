export type FarmSummary = {
  id: string
  accountId: string
  name: string
  gestationDays: number
}

export type BootstrapAccountInput = {
  accountName: string
  firstFarmName: string
}

export interface FarmGateway {
  listFarms(): Promise<FarmSummary[]>
  bootstrapAccount(
    input: BootstrapAccountInput,
  ): Promise<{ accountId: string; farmId: string }>
}
