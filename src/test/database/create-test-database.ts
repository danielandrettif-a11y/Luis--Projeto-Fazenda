import { PGlite, type Results } from '@electric-sql/pglite'

const migrationPath = '/supabase/migrations/202609120001_foundation.sql'
const migrations = import.meta.glob<string>('/supabase/migrations/202609120001_foundation.sql', {
  eager: true,
  import: 'default',
  query: '?raw',
})

function readMigration(): string {
  return migrations[migrationPath] ?? ''
}

export type TestDatabase = {
  close: () => Promise<void>
  sql: <T>(query: string, params?: unknown[]) => Promise<Results<T>>
  createUser: (id: string) => Promise<void>
  authenticate: (id: string) => Promise<void>
  resetRole: () => Promise<void>
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const database = new PGlite()

  await database.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create role anon nologin;
    create role authenticated nologin;

    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `)

  await database.exec(readMigration())

  return {
    close: () => database.close(),
    sql: <T>(query: string, params?: unknown[]) => database.query<T>(query, params),
    createUser: async (id: string) => {
      await database.query('insert into auth.users (id) values ($1)', [id])
    },
    authenticate: async (id: string) => {
      await database.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
      await database.exec('set role authenticated')
    },
    resetRole: async () => {
      await database.exec('reset role')
      await database.query("select set_config('request.jwt.claim.sub', '', false)")
    },
  }
}
