import { afterEach, beforeEach, expect, test } from 'vitest'
import { createTestDatabase, type TestDatabase } from './create-test-database'

const firstUserId = '00000000-0000-4000-8000-000000000011'
const secondUserId = '00000000-0000-4000-8000-000000000012'
const operatorUserId = '00000000-0000-4000-8000-000000000013'
type BootstrapResult = { account_id: string; farm_id: string }

let database: TestDatabase
let firstAccount: BootstrapResult
let secondAccount: BootstrapResult

beforeEach(async () => {
  database = await createTestDatabase()
  await database.createUser(firstUserId)
  await database.createUser(secondUserId)
  await database.authenticate(firstUserId)
  const first = await database.sql<BootstrapResult>(
    "select * from public.bootstrap_account('Primeira Conta', 'Sede Primeira')",
  )
  firstAccount = first.rows[0]!
  await database.resetRole()
  await database.authenticate(secondUserId)
  const second = await database.sql<BootstrapResult>(
    "select * from public.bootstrap_account('Segunda Conta', 'Sede Segunda')",
  )
  secondAccount = second.rows[0]!
  await database.resetRole()
  await database.authenticate(firstUserId)

  const role = await database.sql<{
    role: string; is_owner: boolean; rolsuper: boolean; rolbypassrls: boolean
  }>(`
    select current_user as role, c.relowner = r.oid as is_owner,
      r.rolsuper, r.rolbypassrls
    from pg_catalog.pg_roles r
    join pg_catalog.pg_class c on c.oid = 'public.accounts'::regclass
    where r.rolname = current_user
  `)
  expect(role.rows).toEqual([
    { role: 'authenticated', is_owner: false, rolsuper: false, rolbypassrls: false },
  ])
})

afterEach(async () => {
  await database.close()
})

test('hides another account from an authenticated account admin', async () => {
  const visibleAccounts = await database.sql<{ id: string }>('select id from public.accounts')
  expect(visibleAccounts.rows.map(({ id }) => id)).toEqual([firstAccount.account_id])
})

test('prevents an account admin from updating another account', async () => {
  const result = await database.sql<{ id: string }>(
    "update public.accounts set name = 'Invadida' where id = $1 returning id",
    [secondAccount.account_id],
  )
  expect(result.rows).toEqual([])
  expect(result.affectedRows).toBe(0)
  await database.resetRole()
  const account = await database.sql<{ name: string }>(
    'select name from public.accounts where id = $1', [secondAccount.account_id],
  )
  expect(account.rows).toEqual([{ name: 'Segunda Conta' }])
})

async function authenticateOperator() {
  await database.resetRole()
  await database.createUser(operatorUserId)
  await database.sql(
    "insert into public.memberships (account_id, user_id, role) values ($1, $2, 'operator')",
    [firstAccount.account_id, operatorUserId],
  )
  await database.authenticate(operatorUserId)
}

test('allows an operator to read only farms belonging to their account', async () => {
  await authenticateOperator()
  const farms = await database.sql<{ id: string; name: string }>(
    'select id, name from public.farms',
  )
  expect(farms.rows).toEqual([{ id: firstAccount.farm_id, name: 'Sede Primeira' }])
})

test('prevents an operator from renaming a farm', async () => {
  await authenticateOperator()
  const renamed = await database.sql<{ id: string }>(
    "update public.farms set name = 'Renomeada' where id = $1 returning id",
    [firstAccount.farm_id],
  )
  expect(renamed.rows).toEqual([])
  const farm = await database.sql<{ name: string }>(
    'select name from public.farms where id = $1', [firstAccount.farm_id],
  )
  expect(farm.rows).toEqual([{ name: 'Sede Primeira' }])
})

test('allows an admin to create and rename a farm in their own account', async () => {
  const created = await database.sql<{ id: string }>(
    "insert into public.farms (account_id, name) values ($1, 'Retiro') returning id",
    [firstAccount.account_id],
  )
  expect(created.rows).toHaveLength(1)
  const renamed = await database.sql<{ name: string }>(
    "update public.farms set name = 'Retiro Novo' where id = $1 returning name",
    [created.rows[0]!.id],
  )
  expect(renamed.rows).toEqual([{ name: 'Retiro Novo' }])
})

test('denies anonymous access to account data and privileged functions', async () => {
  await database.resetRole()
  await database.sql('set role anon')
  const role = await database.sql<{ role: string }>('select current_user as role')
  expect(role.rows).toEqual([{ role: 'anon' }])
  for (const table of ['accounts', 'memberships', 'farms', 'paddocks', 'management_groups', 'audit_logs']) {
    await expect(database.sql(`select * from public.${table}`)).rejects.toMatchObject({ code: '42501' })
  }
  for (const query of [
    'select public.current_user_id()',
    `select public.is_account_member('${firstAccount.account_id}')`,
    `select public.is_account_admin('${firstAccount.account_id}')`,
    "select * from public.bootstrap_account('Anônima', 'Sede')",
  ]) {
    await expect(database.sql(query)).rejects.toMatchObject({ code: '42501' })
  }
})

test('allows an admin to read their own audit log while hiding another account log', async () => {
  await database.resetRole()
  await database.sql(`
    insert into public.audit_logs (account_id, actor_user_id, action, entity_type, entity_id)
    values ($1, $2, 'first.created', 'farm', $3), ($4, $5, 'second.created', 'farm', $6)
  `, [firstAccount.account_id, firstUserId, firstAccount.farm_id,
    secondAccount.account_id, secondUserId, secondAccount.farm_id])
  await database.authenticate(firstUserId)
  const logs = await database.sql<{ action: string }>('select action from public.audit_logs')
  expect(logs.rows).toEqual([{ action: 'first.created' }])
})

test('exposes only the current users memberships and prevents client membership management', async () => {
  await authenticateOperator()
  const memberships = await database.sql<{ account_id: string; user_id: string; role: string }>(
    'select account_id, user_id, role from public.memberships',
  )
  expect(memberships.rows).toEqual([
    { account_id: firstAccount.account_id, user_id: operatorUserId, role: 'operator' },
  ])
  await database.resetRole()
  await database.authenticate(firstUserId)
  for (const query of [
    "update public.memberships set role = 'admin' where user_id = $1",
    'delete from public.memberships where user_id = $1',
    `insert into public.memberships (account_id, user_id, role)
      values ('${secondAccount.account_id}', $1, 'admin')`,
  ]) {
    await expect(database.sql(query, [operatorUserId])).rejects.toMatchObject({ code: '42501' })
  }
})

test('restricts account settings to admins and keeps membership helpers scoped to the caller', async () => {
  const renamed = await database.sql<{ name: string }>(
    "update public.accounts set name = 'Primeira Atualizada' where id = $1 returning name",
    [firstAccount.account_id],
  )
  expect(renamed.rows).toEqual([{ name: 'Primeira Atualizada' }])
  await authenticateOperator()
  const result = await database.sql<{ id: string }>(
    "update public.accounts set name = 'Invadida' where id = $1 returning id",
    [firstAccount.account_id],
  )
  expect(result.rows).toEqual([])
  const helpers = await database.sql<{
    user_id: string; own_member: boolean; own_admin: boolean; other_member: boolean; other_admin: boolean
  }>(`select public.current_user_id() as user_id,
    public.is_account_member($1) as own_member, public.is_account_admin($1) as own_admin,
    public.is_account_member($2) as other_member, public.is_account_admin($2) as other_admin`,
  [firstAccount.account_id, secondAccount.account_id])
  expect(helpers.rows).toEqual([{
    user_id: operatorUserId, own_member: true, own_admin: false, other_member: false, other_admin: false,
  }])
})

test.each(['paddocks', 'management_groups'] as const)(
  'isolates %s reads and limits mutations to account admins', async (table) => {
    const created = await database.sql<{ id: string }>(
      `insert into public.${table} (account_id, farm_id, name) values ($1, $2, 'Primeiro') returning id`,
      [firstAccount.account_id, firstAccount.farm_id],
    )
    const id = created.rows[0]!.id
    await database.resetRole()
    await database.authenticate(secondUserId)
    await database.sql(
      `insert into public.${table} (account_id, farm_id, name) values ($1, $2, 'Segundo')`,
      [secondAccount.account_id, secondAccount.farm_id],
    )
    await authenticateOperator()
    const visible = await database.sql<{ id: string }>(`select id from public.${table}`)
    expect(visible.rows).toEqual([{ id }])
    const updated = await database.sql(
      `update public.${table} set name = 'Invadido' where id = $1 returning id`, [id],
    )
    expect(updated.rows).toEqual([])
    const deleted = await database.sql(`delete from public.${table} where id = $1 returning id`, [id])
    expect(deleted.rows).toEqual([])
    await expect(database.sql(
      `insert into public.${table} (account_id, farm_id, name) values ($1, $2, 'Proibido')`,
      [firstAccount.account_id, firstAccount.farm_id],
    )).rejects.toMatchObject({ code: '42501' })
    await database.resetRole()
    await database.authenticate(firstUserId)
    await expect(database.sql(
      `update public.${table} set account_id = $1, farm_id = $2 where id = $3 returning id`,
      [secondAccount.account_id, secondAccount.farm_id, id],
    )).rejects.toMatchObject({ code: '42501' })
    const renamed = await database.sql<{ name: string }>(
      `update public.${table} set name = 'Atualizado' where id = $1 returning name`, [id],
    )
    expect(renamed.rows).toEqual([{ name: 'Atualizado' }])
    const removed = await database.sql<{ id: string }>(
      `delete from public.${table} where id = $1 returning id`, [id],
    )
    expect(removed.rows).toEqual([{ id }])
  },
)

test('keeps audit records append-only and requires the member to be the actor', async () => {
  await authenticateOperator()
  await database.sql(`insert into public.audit_logs
    (account_id, actor_user_id, action, entity_type, entity_id)
    values ($1, $2, 'farm.viewed', 'farm', $3)`,
  [firstAccount.account_id, operatorUserId, firstAccount.farm_id])
  const operatorLogs = await database.sql('select * from public.audit_logs')
  expect(operatorLogs.rows).toEqual([])
  for (const [accountId, actorId] of [
    [firstAccount.account_id, firstUserId], [secondAccount.account_id, operatorUserId],
  ]) {
    await expect(database.sql(`insert into public.audit_logs
      (account_id, actor_user_id, action, entity_type, entity_id)
      values ($1, $2, 'forged', 'farm', $3)`,
    [accountId, actorId, firstAccount.farm_id])).rejects.toMatchObject({ code: '42501' })
  }
  await database.resetRole()
  await database.authenticate(firstUserId)
  const logs = await database.sql<{ actor_user_id: string }>('select actor_user_id from public.audit_logs')
  expect(logs.rows).toEqual([{ actor_user_id: operatorUserId }])
  await expect(database.sql("update public.audit_logs set action = 'changed'"))
    .rejects.toMatchObject({ code: '42501' })
  await expect(database.sql('delete from public.audit_logs')).rejects.toMatchObject({ code: '42501' })
})
