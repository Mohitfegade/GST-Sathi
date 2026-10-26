-- Migration 100: Client Invites & Auth Helper Functions
-- Table public.client_invites, RLS policies, and security-definer helper functions

-- ============================================================================
-- 1. Table: public.client_invites
-- ============================================================================

create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz,
  constraint fk_client_invites_client_firm foreign key (client_id, firm_id) references public.clients(id, firm_id) on delete cascade
);

comment on table public.client_invites is 'Invitations issued to SME client owners to claim and access their business portal.';
comment on column public.client_invites.firm_id is 'Accounting firm issuing the invitation.';
comment on column public.client_invites.client_id is 'Client organization to which access is being granted.';
comment on column public.client_invites.token_hash is 'SHA-256 hash of the single-use invite token.';
comment on column public.client_invites.expires_at is 'Invitation expiration timestamp (default: 7 days).';
comment on column public.client_invites.accepted_by is 'Auth user who accepted the invitation.';
comment on column public.client_invites.accepted_at is 'Timestamp when the invitation was accepted.';

-- Indexes
create index if not exists idx_client_invites_firm_id on public.client_invites (firm_id);
create index if not exists idx_client_invites_client_id on public.client_invites (client_id);
create index if not exists idx_client_invites_token_hash on public.client_invites (token_hash);
create index if not exists idx_client_invites_expires_at on public.client_invites (expires_at);
create index if not exists idx_client_invites_accepted_at on public.client_invites (accepted_at);

-- Trigger: set_client_invites_updated_at
drop trigger if exists set_client_invites_updated_at on public.client_invites;
create trigger set_client_invites_updated_at
  before update on public.client_invites
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 2. Row Level Security for public.client_invites
-- ============================================================================

alter table public.client_invites enable row level security;

create policy "client_invites_select"
  on public.client_invites
  for select
  to authenticated
  using (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

create policy "client_invites_insert"
  on public.client_invites
  for insert
  to authenticated
  with check (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

create policy "client_invites_update"
  on public.client_invites
  for update
  to authenticated
  using (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  )
  with check (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

create policy "client_invites_delete"
  on public.client_invites
  for delete
  to authenticated
  using (
    public.is_firm_admin(firm_id) or public.is_platform_admin()
  );

-- ============================================================================
-- 3. Security-Definer Helper Functions
-- ============================================================================

-- Function: create_firm_with_admin
create or replace function public.create_firm_with_admin(firm_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.firms (name, created_by)
  values (firm_name, auth.uid())
  returning id into v_firm_id;

  insert into public.firm_members (firm_id, user_id, role)
  values (v_firm_id, auth.uid(), 'admin');

  return v_firm_id;
end;
$$;

-- Function: create_client_invite
create or replace function public.create_client_invite(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm_id uuid;
  v_raw_token text;
  v_hash text;
begin
  select firm_id into v_firm_id
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Client not found';
  end if;

  if not (public.is_firm_admin(v_firm_id) or public.is_platform_admin()) then
    raise exception 'Permission denied';
  end if;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

  insert into public.client_invites (firm_id, client_id, token_hash, created_by)
  values (v_firm_id, p_client_id, v_hash, auth.uid());

  return v_raw_token;
end;
$$;

-- Function: peek_client_invite
create or replace function public.peek_client_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_result jsonb;
begin
  if p_token is null then
    return null;
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select jsonb_build_object(
    'client_name', coalesce(c.trade_name, c.legal_name),
    'firm_name', f.name,
    'client_id', c.id,
    'firm_id', f.id,
    'expires_at', ci.expires_at
  ) into v_result
  from public.client_invites ci
  join public.clients c on c.id = ci.client_id
  join public.firms f on f.id = ci.firm_id
  where ci.token_hash = v_hash
    and ci.expires_at > clock_timestamp()
    and ci.accepted_at is null
    and ci.deleted_at is null;

  return v_result;
end;
$$;

-- Function: accept_client_invite
create or replace function public.accept_client_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_invite record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null then
    raise exception 'Invalid or expired invite token';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select id, firm_id, client_id into v_invite
  from public.client_invites
  where token_hash = v_hash
    and expires_at > clock_timestamp()
    and accepted_at is null
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Invalid or expired invite token';
  end if;

  insert into public.client_access (firm_id, client_id, user_id, role)
  values (v_invite.firm_id, v_invite.client_id, auth.uid(), 'owner')
  on conflict (client_id, user_id) do update
  set role = 'owner',
      deleted_at = null;

  update public.client_invites
  set accepted_by = auth.uid(),
      accepted_at = clock_timestamp()
  where id = v_invite.id;

  return v_invite.client_id;
end;
$$;

-- Function Permissions
grant execute on function public.create_firm_with_admin(text) to authenticated, anon;
grant execute on function public.create_client_invite(uuid) to authenticated, anon;
grant execute on function public.peek_client_invite(text) to authenticated, anon;
grant execute on function public.accept_client_invite(text) to authenticated, anon;
