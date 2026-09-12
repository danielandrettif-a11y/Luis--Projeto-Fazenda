import { afterEach, beforeEach, expect, test } from 'vitest'
import { createTestDatabase, type TestDatabase } from './create-test-database'

const adminId = '00000000-0000-4000-8000-000000000021'
const otherId = '00000000-0000-4000-8000-000000000022'
type Account = { account_id: string; farm_id: string }
type Log = {
  account_id: string; actor_user_id: string | null; action: string
  entity_type: string; entity_id: string
  details: { old: Record<string, unknown> | null; new: Record<string, unknown> | null }
}
let database: TestDatabase
let account: Account

beforeEach(async () => {
  database = await createTestDatabase()
  await database.createUser(adminId)
  await database.createUser(otherId)
  await database.authenticate(adminId)
  account = (await database.sql<Account>(
    "select * from public.bootstrap_account('Conta Principal', 'Sede')",
  )).rows[0]!
})
afterEach(async () => { await database.close() })

// Missing triggers, trusting client metadata, or incorrect tenant attribution must fail these tests.
test('audits all bootstrap inserts with the authenticated actor and real row identities', async () => {
  const logs = await database.sql<Log>('select * from public.audit_logs order by entity_type')
  expect(logs.rows).toHaveLength(3)
  expect(logs.rows).toMatchObject([
    { account_id: account.account_id, actor_user_id: adminId, action: 'INSERT',
      entity_type: 'accounts', entity_id: account.account_id,
      details: { old: null, new: { name: 'Conta Principal' } } },
    { account_id: account.account_id, actor_user_id: adminId, action: 'INSERT',
      entity_type: 'farms', entity_id: account.farm_id,
      details: { old: null, new: { name: 'Sede' } } },
    { account_id: account.account_id, actor_user_id: adminId, action: 'INSERT',
      entity_type: 'memberships', entity_id: adminId,
      details: { old: null, new: { account_id: account.account_id, user_id: adminId, role: 'admin' } } },
  ])
})

test.each(['accounts', 'farms', 'paddocks', 'management_groups'])(
  'stamps and audits %s updates without accepting forged timestamps', async (table) => {
    let id = table === 'accounts' ? account.account_id : account.farm_id
    if (table === 'paddocks' || table === 'management_groups') {
      id = (await database.sql<{ id: string }>(
        `insert into public.${table} (account_id, farm_id, name, created_at, updated_at)
         values ($1, $2, 'Original', '2000-01-01', '2000-01-01') returning id`,
        [account.account_id, account.farm_id],
      )).rows[0]!.id
    }
    const before = (await database.sql<{ created_at: string; updated_at: string }>(
      `select created_at::text, updated_at::text from public.${table} where id = $1`, [id],
    )).rows[0]!
    expect(new Date(before.created_at).getUTCFullYear()).toBeGreaterThan(2000)
    const updated = (await database.sql<{ created_at: string; advanced: boolean }>(
      `update public.${table} set name = 'Atualizado', created_at = '2000-01-01',
       updated_at = '2000-01-01' where id = $1
       returning created_at::text, updated_at > $2::timestamptz as advanced`, [id, before.updated_at],
    )).rows[0]!
    expect(updated.created_at).toEqual(before.created_at)
    expect(updated.advanced).toBe(true)
    const logs = await database.sql<Log>(
      "select * from public.audit_logs where entity_type = $1 and entity_id = $2 and action = 'UPDATE'",
      [table, id],
    )
    expect(logs.rows).toHaveLength(1)
    expect(logs.rows[0]).toMatchObject({ actor_user_id: adminId, account_id: account.account_id,
      details: { new: { name: 'Atualizado' } } })
    expect(logs.rows[0]!.details.old!.name).not.toBe('Atualizado')
  },
)

test.each(['farms', 'paddocks', 'management_groups'])(
  'retains %s insert and delete snapshots after deletion', async (table) => {
    const query = table === 'farms'
      ? `insert into public.${table} (account_id, name) values ($1, 'Temporaria') returning id`
      : `insert into public.${table} (account_id, name, farm_id) values ($1, 'Temporaria', $2) returning id`
    const id = (await database.sql<{ id: string }>(query, table === 'farms'
      ? [account.account_id] : [account.account_id, account.farm_id])).rows[0]!.id
    await database.sql(`delete from public.${table} where id = $1`, [id])
    const logs = await database.sql<Log>(
      'select * from public.audit_logs where entity_type = $1 and entity_id = $2 order by action', [table, id],
    )
    expect(logs.rows).toMatchObject([
      { action: 'DELETE', actor_user_id: adminId, details: { old: { name: 'Temporaria' }, new: null } },
      { action: 'INSERT', actor_user_id: adminId, details: { old: null, new: { name: 'Temporaria' } } },
    ])
  },
)

test('audits trusted membership changes without inventing an actor for server operations', async () => {
  await database.resetRole()
  await database.sql("insert into public.memberships (account_id, user_id, role) values ($1, $2, 'operator')",
    [account.account_id, otherId])
  await database.sql("update public.memberships set role = 'admin' where user_id = $1", [otherId])
  await database.sql('delete from public.memberships where user_id = $1', [otherId])
  await database.authenticate(adminId)
  const logs = await database.sql<Log>(
    "select * from public.audit_logs where entity_type = 'memberships' and entity_id = $1 order by action", [otherId],
  )
  expect(logs.rows).toMatchObject([
    { action: 'DELETE', actor_user_id: null, details: { old: { role: 'admin' }, new: null } },
    { action: 'INSERT', actor_user_id: null, details: { old: null, new: { role: 'operator' } } },
    { action: 'UPDATE', actor_user_id: null, details: { old: { role: 'operator' }, new: { role: 'admin' } } },
  ])
})

test('blocked cross-tenant mutations create no logs and reveal no other tenant details', async () => {
  await database.resetRole()
  await database.authenticate(otherId)
  const other = (await database.sql<Account>(
    "select * from public.bootstrap_account('Conta Secreta', 'Fazenda Secreta')",
  )).rows[0]!
  await database.authenticate(adminId)
  expect((await database.sql('update public.farms set name = $1 where id = $2 returning id',
    ['Invadida', other.farm_id])).rows).toEqual([])
  await expect(database.sql("insert into public.farms (account_id, name) values ($1, 'Invasora')",
    [other.account_id])).rejects.toMatchObject({ code: '42501' })
  const visible = await database.sql<Log>('select * from public.audit_logs')
  expect(visible.rows).toHaveLength(3)
  expect(visible.rows.every((log) => log.account_id === account.account_id)).toBe(true)
  expect(JSON.stringify(visible.rows)).not.toContain('Secreta')
  expect(JSON.stringify(visible.rows)).not.toContain(other.account_id)
  await database.resetRole()
  expect((await database.sql('select * from public.audit_logs')).rows).toHaveLength(6)
})

test('an operator cannot update data or create audit events', async () => {
  await database.resetRole()
  await database.sql("insert into public.memberships (account_id, user_id, role) values ($1, $2, 'operator')",
    [account.account_id, otherId])
  const baseline = (await database.sql('select * from public.audit_logs')).rows.length
  await database.authenticate(otherId)
  expect((await database.sql("update public.farms set name = 'Invadida' where id = $1 returning id",
    [account.farm_id])).rows).toEqual([])
  expect((await database.sql('select * from public.audit_logs')).rows).toEqual([])
  await database.resetRole()
  expect((await database.sql('select * from public.audit_logs')).rows).toHaveLength(baseline)
})

test('rejects moving an audited row even when the caller administers both accounts', async () => {
  const other = (await database.sql<Account>(
    "select * from public.bootstrap_account('Outra Conta', 'Outra Sede')",
  )).rows[0]!
  await expect(database.sql('update public.farms set account_id = $1 where id = $2',
    [other.account_id, account.farm_id])).rejects.toMatchObject({ code: '42501' })
  expect((await database.sql('select * from public.audit_logs')).rows).toHaveLength(6)
})

test('blocks clients from forging audit events even using their real user id', async () => {
  await expect(database.sql(`insert into public.audit_logs
    (account_id, actor_user_id, action, entity_type, entity_id) values ($1, $2, 'forged', 'farms', $3)`,
  [account.account_id, adminId, account.farm_id])).rejects.toMatchObject({ code: '42501' })
})

test.each(['accounts', 'farms', 'paddocks', 'management_groups', 'memberships'])(
  'preserves the audited identity of %s', async (table) => {
    let id = table === 'accounts' ? account.account_id : account.farm_id
    if (table === 'paddocks' || table === 'management_groups') {
      id = (await database.sql<{ id: string }>(
        `insert into public.${table} (account_id, farm_id, name) values ($1, $2, 'Original') returning id`,
        [account.account_id, account.farm_id],
      )).rows[0]!.id
    }
    if (table === 'memberships') {
      await database.resetRole()
      await expect(database.sql('update public.memberships set user_id = $1 where user_id = $2',
        [otherId, adminId])).rejects.toMatchObject({ code: '42501' })
    } else {
      await expect(database.sql(`update public.${table} set id = $1 where id = $2`,
        [otherId, id])).rejects.toMatchObject({ code: '42501' })
    }
  },
)

test('retains account history by restricting account deletion even for the trusted database role', async () => {
  await database.sql('delete from public.farms where id = $1', [account.farm_id])
  await database.resetRole()
  await expect(database.sql('delete from public.accounts where id = $1', [account.account_id]))
    .rejects.toMatchObject({ code: '23001' })
  expect((await database.sql('select * from public.audit_logs')).rows).toHaveLength(4)
})

test('does not grant client execution of audit trigger functions', async () => {
  const functions = await database.sql<{ name: string; secure: boolean; private: boolean; fixed_path: boolean }>(`
    select p.proname as name, p.prosecdef as secure,
      not has_function_privilege('authenticated', p.oid, 'execute')
        and not has_function_privilege('anon', p.oid, 'execute') as private,
      p.proconfig @> array['search_path=""'] as fixed_path
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('stamp_foundation_row', 'audit_foundation_row')
    order by name
  `)
  expect(functions.rows).toEqual([
    { name: 'audit_foundation_row', secure: true, private: true, fixed_path: true },
    { name: 'stamp_foundation_row', secure: true, private: true, fixed_path: true },
  ])
})
