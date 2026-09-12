import { afterEach, beforeEach, expect, test } from 'vitest'
import { createTestDatabase, type TestDatabase } from './create-test-database'

let database: TestDatabase

beforeEach(async () => {
  database = await createTestDatabase()
})

afterEach(async () => {
  await database.close()
})

test('creates an account and its first farm atomically', async () => {
  const userId = '00000000-0000-4000-8000-000000000001'
  await database.createUser(userId)
  await database.authenticate(userId)

  const result = await database.sql<{ account_id: string; farm_id: string }>(
    "select * from public.bootstrap_account('Fazenda Boa Vista', 'Sede')",
  )

  expect(result.rows).toHaveLength(1)
  const membership = await database.sql<{ role: string }>(
    'select role::text as role from public.memberships where user_id = $1',
    [userId],
  )
  expect(membership.rows[0]?.role).toBe('admin')
})

test('rejects duplicate farm names within one account', async () => {
  const userId = '00000000-0000-4000-8000-000000000002'
  await database.createUser(userId)
  await database.authenticate(userId)
  const account = await database.sql<{ account_id: string }>(
    "select account_id from public.bootstrap_account('Fazenda Boa Vista', 'Sede')",
  )
  await database.resetRole()

  await expect(
    database.sql('insert into public.farms (account_id, name) values ($1, $2)', [
      account.rows[0]?.account_id,
      'Sede',
    ]),
  ).rejects.toThrow()
})

test('rejects gestation days outside the supported range', async () => {
  const userId = '00000000-0000-4000-8000-000000000003'
  await database.createUser(userId)
  await database.authenticate(userId)
  const account = await database.sql<{ account_id: string }>(
    "select account_id from public.bootstrap_account('Fazenda Boa Vista', 'Sede')",
  )
  await database.resetRole()

  await expect(
    database.sql(
      'insert into public.farms (account_id, name, gestation_days) values ($1, $2, $3)',
      [account.rows[0]?.account_id, 'Retiro', 249],
    ),
  ).rejects.toThrow()

  await expect(
    database.sql(
      'insert into public.farms (account_id, name, gestation_days) values ($1, $2, $3)',
      [account.rows[0]?.account_id, 'Invernada', 311],
    ),
  ).rejects.toThrow()
})

test('allows the same farm name in different accounts', async () => {
  const firstUserId = '00000000-0000-4000-8000-000000000004'
  const secondUserId = '00000000-0000-4000-8000-000000000005'
  await database.createUser(firstUserId)
  await database.createUser(secondUserId)

  await database.authenticate(firstUserId)
  await database.sql(
    "select * from public.bootstrap_account('Fazenda Boa Vista', 'Sede')",
  )
  await database.resetRole()

  await database.authenticate(secondUserId)
  await expect(
    database.sql("select * from public.bootstrap_account('Fazenda Santa Luzia', 'Sede')"),
  ).resolves.toMatchObject({ rows: [{ account_id: expect.any(String), farm_id: expect.any(String) }] })
})
