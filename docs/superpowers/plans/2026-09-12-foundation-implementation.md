# Farm Management Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a runnable, tested web foundation with authentication, account isolation, roles, property registration, responsive navigation, PWA metadata, CI, and Supabase-ready migrations.

**Architecture:** A React/Vite SPA talks to Supabase through feature-owned gateways. PostgreSQL is the source of truth for tenant isolation and onboarding transactions. Pure domain logic and UI are tested with Vitest; schema, functions, and RLS are exercised against in-process PGlite because Docker and the Supabase CLI are not installed on the workstation.

**Tech Stack:** Node.js 24, npm 11, React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Supabase JS, PGlite, Vitest, Testing Library, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-12-gestao-fazenda-design.md`

## Global Constraints

- User-facing copy is Brazilian Portuguese; code and technical identifiers are English.
- Dates display as `dd/MM/aaaa`, timezone is `America/Sao_Paulo`, weight is kilograms, and currency is BRL.
- Data is private by default and every exposed PostgreSQL object must enforce account membership.
- Roles are exactly `admin` and `operator`; all account members initially see every farm in the account.
- Historical records will be append-only in later plans; this plan establishes actor and timestamp conventions.
- No native application, offline data cache, email alerts, WhatsApp, financial ERP, veterinary inventory, RFID, or government document support.
- Generated scaffolding and configuration files are the only proposed TDD exception. All application behavior starts with a failing test.

---

### Task 1: Toolchain and Tested Application Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/globals.css`
- Create: `.gitignore`

**Interfaces:**
- Produces: `App(): JSX.Element`, the root application component.
- Produces scripts: `dev`, `build`, `lint`, `test`, `test:run`, `typecheck`, and `check`.

- [ ] **Step 1: Add the generated toolchain files**

Create a private ESM package with runtime dependencies `@hookform/resolvers`, `@supabase/supabase-js`, `@tanstack/react-query`, `clsx`, `date-fns`, `lucide-react`, `react`, `react-dom`, `react-hook-form`, `react-router-dom`, `tailwind-merge`, and `zod`. Add development dependencies `@electric-sql/pglite`, `@eslint/js`, `@playwright/test`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `autoprefixer`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `jsdom`, `postcss`, `tailwindcss`, `typescript`, `typescript-eslint`, `vite`, and `vitest`.

Use these scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "test": "vitest",
  "test:run": "vitest run",
  "typecheck": "tsc -b --pretty false",
  "check": "npm run lint && npm run typecheck && npm run test:run && npm run build"
}
```

Configure Vitest in `vite.config.ts` with `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, CSS enabled, and alias `@` to `src`. Configure TypeScript strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and the same alias.

Create the generated `App.tsx` placeholder with `<h1>Vite + React</h1>`. This placeholder and configuration are the approved scaffolding exception; no product behavior is added yet.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is generated and installation exits with code 0.

- [ ] **Step 3: Write the failing application-shell test**

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

test('shows the product name', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Gestão da Fazenda' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the test and verify RED**

Run: `npm run test:run -- src/app/App.test.tsx`

Expected: FAIL because the rendered heading is `Vite + React`.

- [ ] **Step 5: Implement the minimal application shell**

Replace the placeholder with:

```tsx
export function App() {
  return <h1>Gestão da Fazenda</h1>
}
```

Wire `src/main.tsx` to render `<App />` under `StrictMode` and import `src/styles/globals.css`. Add a minimal responsive CSS reset and the project color tokens without building feature layouts yet.

- [ ] **Step 6: Verify GREEN and the baseline**

Run: `npm run test:run -- src/app/App.test.tsx`

Expected: 1 test passes.

Run: `npm run build`

Expected: TypeScript and Vite build exit with code 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js index.html src .gitignore
git commit -m "chore: scaffold farm management web app"
```

### Task 2: Runtime Configuration and Supabase Client

**Files:**
- Create: `.env.example`
- Create: `src/shared/config/public-env.ts`
- Create: `src/shared/config/public-env.test.ts`
- Create: `src/shared/lib/supabase-client.ts`
- Create: `src/shared/lib/supabase-client.test.ts`

**Interfaces:**
- Produces: `PublicEnv = { supabaseUrl: string; supabaseAnonKey: string }`.
- Produces: `parsePublicEnv(input: Record<string, unknown>): PublicEnv`.
- Produces: `createSupabaseBrowserClient(env: PublicEnv): SupabaseClient`.

- [ ] **Step 1: Write failing environment tests**

```ts
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
})
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/shared/config/public-env.test.ts`

Expected: FAIL because `parsePublicEnv` does not exist.

- [ ] **Step 3: Implement validated public configuration**

Use a Zod object requiring a valid URL and a non-empty anonymous key. Return only the stable `PublicEnv` shape. Do not include service-role keys in `.env.example` or frontend code.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- src/shared/config/public-env.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Write and verify a failing client-construction test**

```ts
import { expect, test } from 'vitest'
import { createSupabaseBrowserClient } from './supabase-client'

test('creates a browser client for the configured project', () => {
  const client = createSupabaseBrowserClient({
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-anon-key',
  })
  expect(client.supabaseUrl).toBe('https://project.supabase.co')
})
```

Run: `npm run test:run -- src/shared/lib/supabase-client.test.ts`

Expected: FAIL because `createSupabaseBrowserClient` does not exist.

- [ ] **Step 6: Implement and verify client construction**

Implement the function with `createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })`.

Run: `npm run test:run -- src/shared/config/public-env.test.ts src/shared/lib/supabase-client.test.ts`

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add .env.example src/shared/config src/shared/lib
git commit -m "feat: validate Supabase browser configuration"
```

### Task 3: Tenant and Farm Database Schema

**Files:**
- Create: `supabase/migrations/202609120001_foundation.sql`
- Create: `src/test/database/create-test-database.ts`
- Create: `src/test/database/foundation-schema.test.ts`

**Interfaces:**
- Produces PostgreSQL objects: `app_role`, `accounts`, `memberships`, `farms`, `paddocks`, `management_groups`, `audit_logs`.
- Produces SQL functions: `current_user_id()`, `is_account_member(uuid)`, `is_account_admin(uuid)`, and `bootstrap_account(text, text)`.
- `bootstrap_account` returns `{ account_id uuid, farm_id uuid }`.

- [ ] **Step 1: Create the PGlite test harness**

`createTestDatabase()` must create the `auth` schema, an `auth.users(id uuid primary key)` table, roles `anon` and `authenticated`, and an `auth.uid()` function that reads `request.jwt.claim.sub`. It then reads the migration if present, otherwise executes an empty string. Return the PGlite instance and helpers `createUser(id)`, `authenticate(id)`, and `resetRole()`.

- [ ] **Step 2: Write the failing foundation-schema test**

```ts
import { afterEach, beforeEach, expect, test } from 'vitest'
import { createTestDatabase, type TestDatabase } from './create-test-database'

let database: TestDatabase

beforeEach(async () => { database = await createTestDatabase() })
afterEach(async () => { await database.close() })

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
```

- [ ] **Step 3: Verify RED**

Run: `npm run test:run -- src/test/database/foundation-schema.test.ts`

Expected: FAIL because `public.bootstrap_account` does not exist.

- [ ] **Step 4: Implement the migration**

Create UUID primary keys using `gen_random_uuid()`, `created_at timestamptz not null default now()`, and `updated_at` on mutable records. Use foreign keys with restricted deletion for account-owned operational records. Define:

```sql
create type public.app_role as enum ('admin', 'operator');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  age_buckets_months integer[] not null default array[12, 24, 36, 60],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 120),
  gestation_days integer not null default 283 check (gestation_days between 250 and 310),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, name)
);
```

Add `paddocks` and `management_groups` with UUID, `account_id`, `farm_id`, name, timestamps, a composite foreign key ensuring the farm belongs to the account, and unique names per farm. Add `audit_logs` with account, actor, action, entity type/id, JSON details, and creation timestamp.

Implement `bootstrap_account` as `security definer`, reject anonymous callers, trim both names, create the account, admin membership, and first farm in one transaction, and return both IDs. Set an explicit empty `search_path` and fully qualify every object.

- [ ] **Step 5: Verify GREEN**

Run: `npm run test:run -- src/test/database/foundation-schema.test.ts`

Expected: the account/farm test passes.

- [ ] **Step 6: Add constraint tests**

Add separate tests proving duplicate farm names in one account fail, gestation outside 250–310 days fails, and the same farm name is permitted in two accounts.

Run: `npm run test:run -- src/test/database/foundation-schema.test.ts`

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations src/test/database
git commit -m "feat: add tenant and farm database foundation"
```

### Task 4: Row-Level Security

**Files:**
- Modify: `supabase/migrations/202609120001_foundation.sql`
- Create: `src/test/database/foundation-rls.test.ts`

**Interfaces:**
- Consumes: `is_account_member(uuid)` and `is_account_admin(uuid)`.
- Produces: RLS policies for all foundation tables and grants for `authenticated`.

- [ ] **Step 1: Write a failing cross-account isolation test**

Create two users and bootstrap one account per user. Authenticate as the first user and assert that selecting `accounts` returns only the first account. Also assert that updating the second account affects zero rows.

```ts
expect(visibleAccounts.rows.map(({ id }) => id)).toEqual([firstAccountId])
expect(updateResult.affectedRows).toBe(0)
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/test/database/foundation-rls.test.ts`

Expected: FAIL because the first user can see the second account.

- [ ] **Step 3: Implement least-privilege grants and policies**

Enable and force RLS on every foundation table. Revoke all table and sequence privileges from `anon`. Grant only the operations used by the app to `authenticated`.

Use membership policies for reads. Allow account updates only to admins. Allow farm, paddock, and management-group mutations to admins. Allow users to read their own memberships; allow membership management only through a later server-side invitation workflow. Audit logs are insert-only to authenticated account members and readable only by account admins.

Ensure helper functions are `security definer`, have explicit empty `search_path`, are not executable by `anon`, and cannot leak rows from other accounts.

- [ ] **Step 4: Verify isolation GREEN**

Run: `npm run test:run -- src/test/database/foundation-rls.test.ts`

Expected: cross-account select and update tests pass.

- [ ] **Step 5: Add role-policy tests**

Add tests proving:

- an operator can read their farm;
- an operator cannot rename a farm;
- an admin can create and rename a farm;
- an anonymous role reads no account data;
- an admin in one account cannot read another account's audit log.

Run: `npm run test:run -- src/test/database/foundation-rls.test.ts`

Expected: all 7 RLS tests pass.

- [ ] **Step 6: Run all database tests**

Run: `npm run test:run -- src/test/database`

Expected: schema and RLS suites pass with no unhandled errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202609120001_foundation.sql src/test/database/foundation-rls.test.ts
git commit -m "feat: enforce tenant isolation with RLS"
```

### Task 5: Authentication Boundary and Login

**Files:**
- Create: `src/features/auth/auth-gateway.ts`
- Create: `src/features/auth/supabase-auth-gateway.ts`
- Create: `src/features/auth/AuthProvider.tsx`
- Create: `src/features/auth/AuthProvider.test.tsx`
- Create: `src/features/auth/LoginPage.tsx`
- Create: `src/features/auth/LoginPage.test.tsx`
- Create: `src/app/router.tsx`
- Create: `src/app/router.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `AuthUser = { id: string; email: string }`.
- Produces: `AuthState = { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: AuthUser }`.
- Produces: `AuthGateway` with `getCurrentUser()`, `signIn(email, password)`, `signOut()`, and `onAuthStateChange(listener)`.
- Produces: `useAuth(): AuthContextValue` and protected application routing.

- [ ] **Step 1: Write failing provider tests**

Use an in-memory `AuthGateway` implementing the exact interface. Test loading, anonymous, authenticated, and sign-out transitions by asserting visible text from a small consumer component. Do not mock Supabase internals.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/features/auth/AuthProvider.test.tsx`

Expected: FAIL because `AuthProvider` and `useAuth` do not exist.

- [ ] **Step 3: Implement the authentication boundary**

Implement a context that subscribes once, resolves the initial user, unsubscribes on unmount, and exposes `signIn` and `signOut`. Map Supabase user objects to `AuthUser`; translate invalid credentials to `E-mail ou senha inválidos.` and all other failures to `Não foi possível entrar. Tente novamente.`

- [ ] **Step 4: Verify provider GREEN**

Run: `npm run test:run -- src/features/auth/AuthProvider.test.tsx`

Expected: provider transition tests pass.

- [ ] **Step 5: Write failing login and route tests**

Test that the login form validates email and password, submits through `AuthGateway`, shows the stable Portuguese error, and sends authenticated users to `/app`. Test that an anonymous visit to `/app` redirects to `/entrar` while `/entrar` remains public.

- [ ] **Step 6: Verify RED**

Run: `npm run test:run -- src/features/auth/LoginPage.test.tsx src/app/router.test.tsx`

Expected: FAIL because the page and router do not exist.

- [ ] **Step 7: Implement login and routing**

Build an accessible form with labels `E-mail` and `Senha`, submit button `Entrar`, disabled pending state, error alert, and no registration link. Registration is invitation-only. Add loading, public-login, and protected-route branches. Keep route components thin.

- [ ] **Step 8: Verify GREEN**

Run: `npm run test:run -- src/features/auth src/app/router.test.tsx`

Expected: provider, login, and routing suites pass.

- [ ] **Step 9: Commit**

```bash
git add src/features/auth src/app
git commit -m "feat: add authenticated application boundary"
```

### Task 6: Account Onboarding and Farm Dashboard

**Files:**
- Create: `src/features/farms/farm-gateway.ts`
- Create: `src/features/farms/supabase-farm-gateway.ts`
- Create: `src/features/farms/farm-schemas.ts`
- Create: `src/features/farms/farm-schemas.test.ts`
- Create: `src/features/farms/OnboardingPage.tsx`
- Create: `src/features/farms/OnboardingPage.test.tsx`
- Create: `src/features/farms/FarmDashboardPage.tsx`
- Create: `src/features/farms/FarmDashboardPage.test.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Produces: `FarmSummary = { id: string; accountId: string; name: string; gestationDays: number }`.
- Produces: `BootstrapAccountInput = { accountName: string; firstFarmName: string }`.
- Produces: `FarmGateway` with `listFarms(): Promise<FarmSummary[]>` and `bootstrapAccount(input): Promise<{ accountId: string; farmId: string }>`.

- [ ] **Step 1: Write failing schema tests**

Test trimming, minimum two-character names, maximum 120-character names, and rejection of blank names for both account and first farm.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/features/farms/farm-schemas.test.ts`

Expected: FAIL because the schemas do not exist.

- [ ] **Step 3: Implement farm schemas and verify GREEN**

Create Zod schemas returning trimmed strings and stable messages `Informe o nome da conta.` and `Informe o nome da fazenda.`.

Run: `npm run test:run -- src/features/farms/farm-schemas.test.ts`

Expected: schema tests pass.

- [ ] **Step 4: Write failing onboarding tests**

With an in-memory gateway, test that an authenticated user with no farms sees fields `Nome da conta` and `Nome da fazenda`, can submit valid values, and is sent to `/app`. Test that duplicate submission is prevented while pending and that gateway failure renders an alert without losing entered values.

- [ ] **Step 5: Verify RED**

Run: `npm run test:run -- src/features/farms/OnboardingPage.test.tsx`

Expected: FAIL because `OnboardingPage` does not exist.

- [ ] **Step 6: Implement onboarding and Supabase gateway**

Implement the page with React Hook Form and the Zod resolver. Implement `bootstrapAccount` through the `bootstrap_account` RPC and `listFarms` through the protected `farms` table. Convert database snake_case fields at the gateway boundary.

- [ ] **Step 7: Verify onboarding GREEN**

Run: `npm run test:run -- src/features/farms/OnboardingPage.test.tsx`

Expected: onboarding tests pass.

- [ ] **Step 8: Write failing dashboard tests**

Test empty state redirect to onboarding, farm cards with configured gestation days, account-level heading, and accessible navigation placeholders for `Rebanho`, `Reprodução`, `Sanidade`, and `Relatórios`.

- [ ] **Step 9: Implement dashboard and protected data routing**

Use TanStack Query with key `['farms']`. Route users with no farm to `/configuracao-inicial`; render a responsive dashboard shell otherwise. Navigation placeholders must be disabled and labeled `Em breve`, not linked to nonexistent pages.

- [ ] **Step 10: Verify feature GREEN**

Run: `npm run test:run -- src/features/farms src/app/router.test.tsx`

Expected: farm schema, onboarding, dashboard, and routing tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/features/farms src/app/router.tsx
git commit -m "feat: add account onboarding and farm dashboard"
```

### Task 7: PWA Metadata, CI, Documentation, and Final Verification

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icons/icon.svg`
- Create: `public/_redirects`
- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Create: `src/test/manifest.test.ts`
- Modify: `index.html`

**Interfaces:**
- Produces installable metadata with app name `Gestão da Fazenda`, start URL `/`, standalone display, and theme color.
- Produces Cloudflare SPA fallback through `public/_redirects`.
- Produces CI contract: install, lint, typecheck, test, and build on pushes and pull requests.

- [ ] **Step 1: Write the failing manifest test**

```ts
import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('publishes installable PWA metadata', async () => {
  const raw = await readFile('public/manifest.webmanifest', 'utf8').catch(() => '{}')
  const manifest = JSON.parse(raw)
  expect(manifest).toMatchObject({
    name: 'Gestão da Fazenda',
    short_name: 'Fazenda',
    start_url: '/',
    display: 'standalone',
    lang: 'pt-BR',
  })
})
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/test/manifest.test.ts`

Expected: FAIL because the manifest fields are absent.

- [ ] **Step 3: Implement PWA metadata**

Add the tested fields, description, background/theme colors, and an SVG icon entry. Link the manifest and theme color from `index.html`. Do not register a service worker or cache authenticated data.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- src/test/manifest.test.ts`

Expected: 1 test passes.

- [ ] **Step 5: Add deployment and CI configuration**

Set `public/_redirects` to:

```text
/* /index.html 200
```

Create GitHub Actions CI on `push` and `pull_request` using Node 24, `npm ci`, and `npm run check`. Do not place Supabase secrets in CI; the app build must use non-secret placeholder public values supplied as workflow environment variables.

- [ ] **Step 6: Document local and hosted setup**

README must cover prerequisites, `npm install`, copying `.env.example` to `.env.local`, `npm run dev`, `npm run check`, migration location, how to apply the migration in a development Supabase project, Cloudflare Pages build command `npm run build`, output directory `dist`, and the required public environment variables. State explicitly that real production data requires managed and external backups.

- [ ] **Step 7: Run the full verification gate**

Run: `npm run lint`

Expected: 0 errors and 0 warnings.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run test:run`

Expected: all unit, component, schema, and RLS tests pass.

Run: `npm run build`

Expected: production bundle is generated in `dist` with exit code 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 8: Commit**

```bash
git add public index.html .github/workflows/ci.yml README.md src/test/manifest.test.ts
git commit -m "chore: add PWA metadata CI and setup guide"
```

- [ ] **Step 9: Review against the foundation acceptance criteria**

Confirm with test or inspected evidence that authentication redirects work, tenant isolation tests cover read and update paths, onboarding creates an admin and first farm atomically, operator/admin differences are enforced, responsive navigation renders, the application builds, and no service-role secret exists in tracked files.
