-- Migration 010: Tenancy
-- Core tenancy tables: firms, firm_members, clients, client_access, platform_admins

-- 1. firms
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);

-- 2. firm_members
create table public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.firm_role not null default 'staff',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (firm_id, user_id)
);

-- 3. clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  legal_name text not null,
  trade_name text,
  gstin text not null check (length(gstin) = 15 and gstin = upper(gstin)),
  state_code text not null check (length(state_code) = 2 and state_code ~ '^[0-9]{2}$'),
  scheme public.scheme not null default 'regular',
  aato_band public.aato_band not null default 'below_40l',
  fy_start_month smallint not null default 4 check (fy_start_month between 1 and 12),
  language public.lang not null default 'en',
  sells_exempt boolean not null default false,
  sells_taxable boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint uq_clients_id_firm_id unique (id, firm_id)
);

-- Active GSTIN unique per firm
create unique index uq_clients_firm_gstin_active
  on public.clients (firm_id, gstin)
  where deleted_at is null;

-- 4. client_access
create table public.client_access (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.client_role not null default 'staff',
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  unique (client_id, user_id),
  constraint fk_client_access_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade
);

-- 5. platform_admins
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);

-- Indexes
create index idx_firms_created_by on public.firms (created_by);
create index idx_firm_members_firm_id on public.firm_members (firm_id);
create index idx_firm_members_user_id on public.firm_members (user_id);
create index idx_clients_firm_id on public.clients (firm_id);
create index idx_client_access_firm_id on public.client_access (firm_id);
create index idx_client_access_client_id on public.client_access (client_id);
create index idx_client_access_user_id on public.client_access (user_id);

-- Updated_at triggers
create trigger set_firms_updated_at
  before update on public.firms
  for each row
  execute function public.set_updated_at();

create trigger set_firm_members_updated_at
  before update on public.firm_members
  for each row
  execute function public.set_updated_at();

create trigger set_clients_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

create trigger set_client_access_updated_at
  before update on public.client_access
  for each row
  execute function public.set_updated_at();

-- Enable RLS (Deny by default on all tables)
alter table public.firms enable row level security;
alter table public.firm_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_access enable row level security;
alter table public.platform_admins enable row level security;

-- RLS Policies: firms
create policy "firms_select"
  on public.firms
  for select
  to authenticated
  using (
    public.is_firm_member(id) or public.is_platform_admin()
  );

create policy "firms_insert"
  on public.firms
  for insert
  to authenticated
  with check (
    auth.uid() is not null
  );

create policy "firms_update"
  on public.firms
  for update
  to authenticated
  using (
    public.is_firm_admin(id) or public.is_platform_admin()
  )
  with check (
    public.is_firm_admin(id) or public.is_platform_admin()
  );

create policy "firms_delete"
  on public.firms
  for delete
  to authenticated
  using (
    public.is_firm_admin(id) or public.is_platform_admin()
  );

-- RLS Policies: firm_members
create policy "firm_members_select"
  on public.firm_members
  for select
  to authenticated
  using (
    public.is_firm_member(firm_id) or public.is_platform_admin()
  );

create policy "firm_members_insert"
  on public.firm_members
  for insert
  to authenticated
  with check (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

create policy "firm_members_update"
  on public.firm_members
  for update
  to authenticated
  using (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  )
  with check (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

create policy "firm_members_delete"
  on public.firm_members
  for delete
  to authenticated
  using (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

-- RLS Policies: clients
create policy "clients_select"
  on public.clients
  for select
  to authenticated
  using (
    public.is_firm_member(firm_id)
    or public.is_client_owner(id)
    or public.is_platform_admin()
  );

create policy "clients_insert"
  on public.clients
  for insert
  to authenticated
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "clients_update"
  on public.clients
  for update
  to authenticated
  using (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  )
  with check (
    public.is_firm_member(firm_id)
    or public.is_platform_admin()
  );

create policy "clients_delete"
  on public.clients
  for delete
  to authenticated
  using (
    public.is_firm_admin(firm_id)
    or public.is_platform_admin()
  );

-- RLS Policies: client_access
create policy "client_access_select"
  on public.client_access
  for select
  to authenticated
  using (
    public.is_firm_member(firm_id)
    or user_id = auth.uid()
    or public.is_platform_admin()
  );

create policy "client_access_insert"
  on public.client_access
  for insert
  to authenticated
  with check (
    public.is_platform_admin()
    or (
      public.is_firm_admin(firm_id)
      and exists (
        select 1 from public.clients c
        where c.id = client_access.client_id
          and c.firm_id = client_access.firm_id
      )
    )
  );

create policy "client_access_update"
  on public.client_access
  for update
  to authenticated
  using (
    public.is_platform_admin()
    or (
      public.is_firm_admin(firm_id)
      and exists (
        select 1 from public.clients c
        where c.id = client_access.client_id
          and c.firm_id = client_access.firm_id
      )
    )
  )
  with check (
    public.is_platform_admin()
    or (
      public.is_firm_admin(firm_id)
      and exists (
        select 1 from public.clients c
        where c.id = client_access.client_id
          and c.firm_id = client_access.firm_id
      )
    )
  );

create policy "client_access_delete"
  on public.client_access
  for delete
  to authenticated
  using (
    public.is_platform_admin()
    or (
      public.is_firm_admin(firm_id)
      and exists (
        select 1 from public.clients c
        where c.id = client_access.client_id
          and c.firm_id = client_access.firm_id
      )
    )
  );

-- RLS Policies: platform_admins (select only; no insert/update/delete via client)
create policy "platform_admins_select"
  on public.platform_admins
  for select
  to authenticated
  using (
    public.is_platform_admin()
  );
