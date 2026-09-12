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
  -- NULL means a trusted server operation without a user JWT, never a guessed actor.
  actor_user_id uuid references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Timestamps belong to the database. Keep tenant ownership stable so an audit
-- snapshot can never move into another tenant's readable history.
create function public.stamp_foundation_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.created_at := pg_catalog.clock_timestamp();
  else
    if pg_catalog.to_jsonb(NEW)->'id' is distinct from pg_catalog.to_jsonb(OLD)->'id'
      or pg_catalog.to_jsonb(NEW)->'user_id' is distinct from pg_catalog.to_jsonb(OLD)->'user_id' then
      raise exception 'A identidade do registro não pode ser alterada.' using errcode = '42501';
    end if;
    if pg_catalog.to_jsonb(NEW)->'account_id' is distinct from pg_catalog.to_jsonb(OLD)->'account_id' then
      raise exception 'A conta do registro não pode ser alterada.' using errcode = '42501';
    end if;
    NEW.created_at := OLD.created_at;
  end if;
  if TG_TABLE_NAME <> 'memberships' then
    NEW.updated_at := pg_catalog.clock_timestamp();
  end if;
  return NEW;
end;
$$;

-- Only installed row triggers invoke this function. No client-supplied actor,
-- action or details are accepted; RLS/constraints and audit share one transaction.
create function public.audit_foundation_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  target_row jsonb;
begin
  if TG_OP <> 'INSERT' then old_row := pg_catalog.to_jsonb(OLD); end if;
  if TG_OP <> 'DELETE' then new_row := pg_catalog.to_jsonb(NEW); end if;
  target_row := coalesce(new_row, old_row);
  insert into public.audit_logs (account_id, actor_user_id, action, entity_type, entity_id, details)
  values (
    (case when TG_TABLE_NAME = 'accounts' then target_row->>'id' else target_row->>'account_id' end)::uuid,
    auth.uid(), TG_OP, TG_TABLE_NAME,
    (case when TG_TABLE_NAME = 'memberships' then target_row->>'user_id' else target_row->>'id' end)::uuid,
    pg_catalog.jsonb_build_object('old', old_row, 'new', new_row)
  );
  return null;
end;
$$;

create trigger accounts_stamp before insert or update on public.accounts
  for each row execute function public.stamp_foundation_row();
create trigger accounts_audit after insert or update or delete on public.accounts
  for each row execute function public.audit_foundation_row();
create trigger memberships_stamp before insert or update on public.memberships
  for each row execute function public.stamp_foundation_row();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function public.audit_foundation_row();
create trigger farms_stamp before insert or update on public.farms
  for each row execute function public.stamp_foundation_row();
create trigger farms_audit after insert or update or delete on public.farms
  for each row execute function public.audit_foundation_row();
create trigger paddocks_stamp before insert or update on public.paddocks
  for each row execute function public.stamp_foundation_row();
create trigger paddocks_audit after insert or update or delete on public.paddocks
  for each row execute function public.audit_foundation_row();
create trigger management_groups_stamp before insert or update on public.management_groups
  for each row execute function public.stamp_foundation_row();
create trigger management_groups_audit after insert or update or delete on public.management_groups
  for each row execute function public.audit_foundation_row();

revoke all on function public.stamp_foundation_row(), public.audit_foundation_row()
  from public, anon, authenticated;

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

-- Remove inherited PUBLIC and Supabase default privileges before granting the
-- precise client operations. Membership writes are reserved for server workflows.
revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
revoke all on public.accounts, public.memberships, public.farms,
  public.paddocks, public.management_groups, public.audit_logs from authenticated;
grant usage on schema public to authenticated;
grant select, update on public.accounts to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.farms, public.paddocks,
  public.management_groups to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on function public.current_user_id(), public.is_account_member(uuid),
  public.is_account_admin(uuid), public.bootstrap_account(text, text) from public, anon;
grant execute on function public.current_user_id(), public.is_account_member(uuid),
  public.is_account_admin(uuid), public.bootstrap_account(text, text) to authenticated;

-- SECURITY DEFINER helpers and bootstrap must be owned by the trusted migration
-- role with BYPASSRLS (Supabase postgres), so FORCE RLS neither recurses through
-- membership helpers nor prevents creation of the initial account/membership.
alter table public.accounts enable row level security;
alter table public.accounts force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.farms enable row level security;
alter table public.farms force row level security;
alter table public.paddocks enable row level security;
alter table public.paddocks force row level security;
alter table public.management_groups enable row level security;
alter table public.management_groups force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create policy accounts_read on public.accounts
  for select to authenticated
  using (public.is_account_member(id));

create policy accounts_update on public.accounts
  for update to authenticated
  using (public.is_account_admin(id))
  with check (public.is_account_admin(id));

create policy memberships_read_own on public.memberships
  for select to authenticated
  using (user_id = public.current_user_id());

create policy farms_read on public.farms
  for select to authenticated
  using (public.is_account_member(account_id));
create policy farms_insert on public.farms
  for insert to authenticated
  with check (public.is_account_admin(account_id));
create policy farms_update on public.farms
  for update to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));
create policy farms_delete on public.farms
  for delete to authenticated
  using (public.is_account_admin(account_id));

create policy paddocks_read on public.paddocks
  for select to authenticated
  using (public.is_account_member(account_id));
create policy paddocks_insert on public.paddocks
  for insert to authenticated
  with check (public.is_account_admin(account_id));
create policy paddocks_update on public.paddocks
  for update to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));
create policy paddocks_delete on public.paddocks
  for delete to authenticated
  using (public.is_account_admin(account_id));

create policy management_groups_read on public.management_groups
  for select to authenticated
  using (public.is_account_member(account_id));
create policy management_groups_insert on public.management_groups
  for insert to authenticated
  with check (public.is_account_admin(account_id));
create policy management_groups_update on public.management_groups
  for update to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));
create policy management_groups_delete on public.management_groups
  for delete to authenticated
  using (public.is_account_admin(account_id));

create policy audit_logs_read on public.audit_logs
  for select to authenticated
  using (public.is_account_admin(account_id));
