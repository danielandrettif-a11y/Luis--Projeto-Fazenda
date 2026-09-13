import { z } from 'zod'

const accountNameSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome da conta.')
  .max(120, 'O nome da conta deve ter no máximo 120 caracteres.')

const farmNameSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome da fazenda.')
  .max(120, 'O nome da fazenda deve ter no máximo 120 caracteres.')

export const bootstrapAccountSchema = z.object({
  accountName: accountNameSchema,
  firstFarmName: farmNameSchema,
})
