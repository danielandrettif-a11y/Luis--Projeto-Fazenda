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
  unique (account_id, id),
  unique (account_id, name)
);

create table public.paddocks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  farm_id uuid not null,
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, farm_id)
    references public.farms(account_id, id) on delete restrict,
  unique (account_id, farm_id, name)
);

create table public.management_groups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  farm_id uuid not null,
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, farm_id)
    references public.farms(account_id, id) on delete restrict,
  unique (account_id, farm_id, name)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
$$;

create function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where public.memberships.account_id = target_account_id
      and public.memberships.user_id = auth.uid()
  )
$$;

create function public.is_account_admin(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where public.memberships.account_id = target_account_id
      and public.memberships.user_id = auth.uid()
      and public.memberships.role = 'admin'::public.app_role
  )
$$;

create function public.bootstrap_account(account_name text, farm_name text)
returns table (account_id uuid, farm_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  new_account_id uuid;
  new_farm_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Autenticação necessária para criar a conta.';
  end if;

  insert into public.accounts (name)
  values (pg_catalog.btrim(account_name))
  returning public.accounts.id into new_account_id;

  insert into public.memberships (account_id, user_id, role)
  values (new_account_id, authenticated_user_id, 'admin'::public.app_role);

  insert into public.farms (account_id, name)
  values (new_account_id, pg_catalog.btrim(farm_name))
  returning public.farms.id into new_farm_id;

  return query select new_account_id, new_farm_id;
end;
$$;

grant select on public.memberships to authenticated;
