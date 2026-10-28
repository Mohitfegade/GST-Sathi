-- Migration 110: Client Support
-- Enhancements for Client Management & Client Invites:
-- 1. Partial unique index ensuring active GSTIN uniqueness per accounting firm
-- 2. Fast search and lookup indexes on clients (legal_name, trade_name, gstin)
-- 3. Archive / Restore security trigger preventing non-admins from soft-deleting or un-deleting clients
-- 4. Stricter client_invites delete and update RLS policies preventing modification of accepted invites

-- ============================================================================
-- 1. Partial Unique Index for Active Clients per Firm
-- ============================================================================
-- Ensure that within each firm, active (non-archived / deleted_at is null)
-- clients have a unique GSTIN. Once archived, the GSTIN can be re-used/re-registered.
create unique index if not exists uq_clients_firm_gstin_active
  on public.clients (firm_id, gstin)
  where deleted_at is null;

-- ============================================================================
-- 2. Search & Lookup Indexes for Fast Client Filtering
-- ============================================================================
-- Support fast case-insensitive search and prefix lookups by legal name, trade name,
-- and exact GSTIN lookups scoped by firm_id on the accountant dashboard.
create index if not exists idx_clients_firm_legal_name
  on public.clients (firm_id, lower(legal_name));

create index if not exists idx_clients_firm_trade_name
  on public.clients (firm_id, lower(trade_name));

create index if not exists idx_clients_firm_gstin
  on public.clients (firm_id, gstin);

-- ============================================================================
-- 3. Client Archive / Restore Authorization Trigger
-- ============================================================================
-- Prevent non-admin firm members (e.g. staff) from archiving (deleted_at = now())
-- or restoring (deleted_at = null) clients. Only firm admins and platform admins
-- possess lifecycle authority to alter a client's archive status.
create or replace function public.check_client_archive_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.deleted_at is distinct from new.deleted_at) then
    if not (public.is_firm_admin(new.firm_id) or public.is_platform_admin()) then
      raise exception 'Only firm admins can archive or restore clients';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.check_client_archive_permission() is
  'Restricts soft-deleting (archiving) or restoring client records to firm admins and platform admins only.';

drop trigger if exists trg_check_client_archive_permission on public.clients;
create trigger trg_check_client_archive_permission
  before update on public.clients
  for each row
  execute function public.check_client_archive_permission();

-- ============================================================================
-- 4. Client Invites Revoke & Delete RLS Policies
-- ============================================================================
-- Ensure pending invitations can only be deleted or revoked/updated by firm
-- administrators (or platform admins), and strictly while accepted_at is null.
-- Once an invite has been accepted, it becomes immutable audit history.

drop policy if exists "client_invites_delete" on public.client_invites;
create policy "client_invites_delete"
  on public.client_invites
  for delete
  to authenticated
  using (
    (public.is_firm_admin(firm_id) or public.is_platform_admin())
    and accepted_at is null
  );

drop policy if exists "client_invites_update" on public.client_invites;
create policy "client_invites_update"
  on public.client_invites
  for update
  to authenticated
  using (
    (public.is_firm_admin(firm_id) or public.is_platform_admin())
    and accepted_at is null
  )
  with check (
    (public.is_firm_admin(firm_id) or public.is_platform_admin())
    and accepted_at is null
  );
