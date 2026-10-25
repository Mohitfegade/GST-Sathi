-- Migration 000: Base schema setup
-- Extensions, enums, triggers, and security-definer helper functions

create extension if not exists "pgcrypto";

-- Enums
create type public.firm_role as enum ('admin', 'staff');
create type public.client_role as enum ('owner', 'staff');
create type public.scheme as enum ('regular', 'qrmp', 'composition', 'unregistered');
create type public.aato_band as enum ('below_40l', '40l_to_1_5cr', '1_5cr_to_5cr', 'above_5cr');
create type public.lang as enum ('en', 'hi', 'mr');
create type public.doc_kind as enum ('purchase_bill', 'gstr2b_file', 'sales_file', 'bank_file', 'other');
create type public.doc_status as enum ('uploaded', 'queued', 'processing', 'needs_review', 'done', 'failed');
create type public.inv_status as enum ('draft', 'needs_review', 'approved', 'rejected');
create type public.inv_source as enum ('extracted', 'manual', 'imported');
create type public.itc_state as enum ('eligible', 'ineligible', 'blocked', 'pending');
create type public.filing_status as enum ('unknown', 'filed', 'not_filed', 'cancelled');
create type public.pay_mode as enum ('cash', 'upi', 'bank', 'other');
create type public.rate_status as enum ('ok', 'mismatch', 'unknown');
create type public.gstr2b_section as enum ('b2b', 'b2ba', 'cdnr', 'cdnra');
create type public.ims_action as enum ('none', 'accepted', 'rejected', 'pending');
create type public.recon_status as enum ('matched', 'fuzzy_match', 'period_shift', 'missing_in_2b', 'missing_in_books', 'mismatch');
create type public.user_decision as enum ('none', 'accepted', 'disputed', 'ignored');
create type public.sales_source as enum ('manual', 'csv', 'upi_statement');
create type public.sales_doc_type as enum ('tax_invoice', 'bill_of_supply', 'invoice_cum_bos', 'credit_note', 'debit_note');
create type public.return_type as enum ('gstr1', 'gstr3b', 'cmp08', 'gstr4');
create type public.return_status as enum ('not_started', 'draft', 'in_review', 'approved', 'filed');
create type public.alert_kind as enum ('deadline', 'itc_at_risk', 'threshold', 'missing_docs', 'rule_change', 'late_fee');
create type public.severity as enum ('info', 'warn', 'urgent');
create type public.alert_status as enum ('open', 'dismissed', 'done');

-- Trigger function to update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

-- Security-definer helper functions
-- All have search_path explicitly set to '' for security against search_path attacks.

-- Checks if the authenticated user is a member of the specified firm
create or replace function public.is_firm_member(firm uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.firm_members
    where firm_id = firm
      and user_id = auth.uid()
  );
end;
$$;

-- Checks if the authenticated user is an admin of the specified firm
create or replace function public.is_firm_admin(firm uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.firm_members
    where firm_id = firm
      and user_id = auth.uid()
      and role = 'admin'
  );
end;
$$;

-- Checks if the authenticated user has access to the client
-- Access is granted if:
-- 1) The user is a member of the firm that manages the client, OR
-- 2) The user has an explicit client_access grant for this client.
create or replace function public.has_client_access(client uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Check client_access direct assignment
  if exists (
    select 1
    from public.client_access
    where client_id = client
      and user_id = auth.uid()
  ) then
    return true;
  end if;

  -- Check firm membership through the client's managing firm
  return exists (
    select 1
    from public.clients c
    join public.firm_members fm on fm.firm_id = c.firm_id
    where c.id = client
      and fm.user_id = auth.uid()
  );
end;
$$;

-- Checks if the authenticated user is an owner of the specified client (via client_access)
create or replace function public.is_client_owner(client uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.client_access
    where client_id = client
      and user_id = auth.uid()
      and role = 'owner'
  );
end;
$$;

-- Checks if the authenticated user is a platform admin
create or replace function public.is_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
    from public.platform_admins
    where user_id = auth.uid()
  );
end;
$$;
