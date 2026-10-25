-- pgTAP Test Suite: RLS Rules, Audit Events, Storage Policies
-- Verifies row-level security, role permissions, statutory append-only immutability,
-- and hierarchical storage path isolation.

begin;

-- Initialize pgTAP plan: exactly 58 assertions
select plan(58);

-- ============================================================================
-- 0. Environment Setup & Compatibilities
-- ============================================================================

-- Ensure standard Supabase roles exist
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

-- Ensure auth schema, users table, and auth helper functions exist
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  aud text default 'authenticated',
  role text default 'authenticated',
  email text,
  email_confirmed_at timestamptz default now(),
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_setting('role', true)
  );
$$;

-- Ensure storage schema, objects, and folder helper function exist
do $$
begin
  if not exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'objects') then
    create schema if not exists storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean default false
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid,
      created_at timestamptz default clock_timestamp(),
      updated_at timestamptz default clock_timestamp(),
      last_accessed_at timestamptz default clock_timestamp(),
      metadata jsonb default '{}'::jsonb
    );
    create or replace function storage.foldername(name text)
    returns text[]
    language plpgsql
    immutable
    as $fn$
    declare
      _parts text[];
    begin
      select string_to_array(name, '/') into _parts;
      return _parts[1 : (array_length(_parts, 1) - 1)];
    end
    $fn$;

    alter table storage.objects enable row level security;

    create policy "documents_storage_select"
      on storage.objects
      for select
      using (
        bucket_id = 'documents'
        and (
          public.is_platform_admin()
          or (
            name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
            and (
              public.is_firm_member((storage.foldername(name))[1]::uuid)
              or (
                public.is_client_owner((storage.foldername(name))[2]::uuid)
                and exists (
                  select 1 from public.clients c
                  where c.id = (storage.foldername(name))[2]::uuid
                    and c.firm_id = (storage.foldername(name))[1]::uuid
                )
              )
            )
          )
        )
      );

    create policy "documents_storage_insert"
      on storage.objects
      for insert
      with check (
        bucket_id = 'documents'
        and (
          public.is_platform_admin()
          or (
            name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
            and (
              public.is_firm_member((storage.foldername(name))[1]::uuid)
              or (
                public.is_client_owner((storage.foldername(name))[2]::uuid)
                and exists (
                  select 1 from public.clients c
                  where c.id = (storage.foldername(name))[2]::uuid
                    and c.firm_id = (storage.foldername(name))[1]::uuid
                )
              )
            )
          )
        )
      );

    create policy "documents_storage_update"
      on storage.objects
      for update
      using (
        bucket_id = 'documents'
        and (
          public.is_platform_admin()
          or (
            name ~ '^[0-9a-fA-F-]{36}/'
            and public.is_firm_member((storage.foldername(name))[1]::uuid)
          )
        )
      )
      with check (
        bucket_id = 'documents'
        and (
          public.is_platform_admin()
          or (
            name ~ '^[0-9a-fA-F-]{36}/'
            and public.is_firm_member((storage.foldername(name))[1]::uuid)
          )
        )
      );

    create policy "documents_storage_delete"
      on storage.objects
      for delete
      using (
        bucket_id = 'documents'
        and (
          public.is_platform_admin()
          or (
            name ~ '^[0-9a-fA-F-]{36}/'
            and public.is_firm_admin((storage.foldername(name))[1]::uuid)
          )
        )
      );
  end if;
end $$;

-- Grant schema and table access to anon and authenticated
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

-- ============================================================================
-- 1. Test Fixtures Setup (Run as Superuser / postgres)
-- ============================================================================

-- Test Users
-- Firm A Admin:    a0000000-0000-0000-0000-000000000001
-- Firm A Staff:    a0000000-0000-0000-0000-000000000002
-- Firm B Admin:    b0000000-0000-0000-0000-000000000001
-- Firm B Staff:    b0000000-0000-0000-0000-000000000002
-- Client 1 Owner:  c0000000-0000-0000-0000-000000000001 (Firm A, Client 1)
-- Client 2 Owner:  c0000000-0000-0000-0000-000000000002 (Firm A, Client 2)
-- Client 3 Owner:  c0000000-0000-0000-0000-000000000003 (Firm B, Client 3)
-- Platform Admin:  p0000000-0000-0000-0000-000000000001
-- Outsider:        e0000000-0000-0000-0000-000000000001

insert into auth.users (id, aud, role, email)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_a_admin@test.local'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_a_staff@test.local'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'firm_b_admin@test.local'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'firm_b_staff@test.local'),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'client_1_owner@test.local'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'authenticated', 'authenticated', 'client_2_owner@test.local'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'authenticated', 'authenticated', 'client_3_owner@test.local'),
  ('p0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'platform_admin@test.local'),
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'authenticated', 'authenticated', 'outsider@test.local')
on conflict (id) do nothing;

-- Test Firms: Firm A & Firm B
insert into public.firms (id, name, created_by)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Audit & Rules CA Firm A', 'a0000000-0000-0000-0000-000000000001'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Audit & Rules CA Firm B', 'b0000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

-- Firm Members
insert into public.firm_members (firm_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'staff'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'staff')
on conflict (firm_id, user_id) do nothing;

-- Clients
insert into public.clients (id, firm_id, legal_name, trade_name, gstin, state_code, scheme, aato_band)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client 1 Firm A Retail', 'Client 1 Store', '27AAAAA1111A1Z1', '27', 'regular', 'below_40l'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Client 2 Firm A Stationers', 'Client 2 Store', '27AAAAA2222A1Z2', '27', 'regular', 'below_40l'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Client 3 Firm B Traders', 'Client 3 Store', '24BBBBB3333B1Z3', '24', 'regular', 'below_40l')
on conflict (id) do nothing;

-- Client Access Grants
insert into public.client_access (firm_id, client_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'owner'),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'owner'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'owner')
on conflict (client_id, user_id) do nothing;

-- Platform Admins
insert into public.platform_admins (user_id)
values
  ('p0000000-0000-0000-0000-000000000001'::uuid)
on conflict (user_id) do nothing;

-- Seed Rules: gst_rate_rules & rule_params
insert into public.gst_rate_rules (id, hsn_prefix, description_pattern, rate, effective_from, source_ref, verified_by_ca, notes)
values
  ('r1111111-1111-1111-1111-111111111111'::uuid, '48', 'Paper and paperboard articles', 12.00, '2024-01-01', 'Notification 01/2017-CT(R)', true, 'Initial rule')
on conflict (id) do nothing;

insert into public.rule_params (id, key, value, effective_from, source_ref, verified_by_ca)
values
  ('rp111111-1111-1111-1111-111111111111'::uuid, 'composition_turnover_threshold', '{"limit_inr": 15000000}'::jsonb, '2024-01-01', 'Section 10 CGST Act', true)
on conflict (id) do nothing;

-- Seed Audit Events
insert into public.audit_events (id, firm_id, client_id, actor_id, action, entity, entity_id, before, after)
values
  ('ae111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'INSERT', 'invoices', 'i1111111-1111-1111-1111-111111111111'::uuid, null, '{"invoice_no": "INV-A-001"}'::jsonb),
  ('ae222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'INSERT', 'invoices', 'i2222222-2222-2222-2222-222222222222'::uuid, null, '{"invoice_no": "INV-B-001"}'::jsonb)
on conflict (id) do nothing;

-- Seed Storage Buckets & Objects
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into storage.objects (id, bucket_id, name)
values
  ('so111111-1111-1111-1111-111111111111'::uuid, 'documents', '11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/doc1/bill1.pdf'),
  ('so111111-1111-1111-1111-222222222222'::uuid, 'documents', '11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/doc2/bill2.pdf'),
  ('so222222-2222-2222-2222-333333333333'::uuid, 'documents', '22222222-2222-2222-2222-222222222222/cccccccc-cccc-cccc-cccc-cccccccccccc/doc3/bill3.pdf')
on conflict (id) do nothing;

-- Verify Seed Setup (Tests 1-7)
select results_eq(
  'select count(*)::integer from public.firms where id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Setup: Firm A successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.firms where id = ''22222222-2222-2222-2222-222222222222''',
  array[1],
  'Setup: Firm B successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Setup: Initial gst_rate_rules successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.rule_params where id = ''rp111111-1111-1111-1111-111111111111''',
  array[1],
  'Setup: Initial rule_params successfully seeded'
);

select results_eq(
  'select count(*)::integer from public.audit_events where id = ''ae111111-1111-1111-1111-111111111111''',
  array[1],
  'Setup: Initial audit_event for Firm A successfully seeded'
);

select results_eq(
  'select count(*)::integer from storage.buckets where id = ''documents''',
  array[1],
  'Setup: Storage documents bucket successfully seeded'
);

select results_eq(
  'select count(*)::integer from storage.objects where bucket_id = ''documents'' and id in (''so111111-1111-1111-1111-111111111111'', ''so111111-1111-1111-1111-222222222222'', ''so222222-2222-2222-2222-333333333333'')',
  array[3],
  'Setup: Initial storage objects successfully seeded'
);

-- ============================================================================
-- 2. Rules Table Assertions (Tests 8-29)
-- ============================================================================

-- 2.1 Any authenticated user can SELECT from gst_rate_rules and rule_params

-- Firm Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Admin can SELECT from gst_rate_rules'
);

select results_eq(
  'select count(*)::integer from public.rule_params where id = ''rp111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Admin can SELECT from rule_params'
);

-- Firm Staff
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Staff can SELECT from gst_rate_rules'
);

select results_eq(
  'select count(*)::integer from public.rule_params where id = ''rp111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Staff can SELECT from rule_params'
);

-- Client Owner
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Client Owner can SELECT from gst_rate_rules'
);

select results_eq(
  'select count(*)::integer from public.rule_params where id = ''rp111111-1111-1111-1111-111111111111''',
  array[1],
  'Client Owner can SELECT from rule_params'
);

-- Generic Authenticated Outsider
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Generic authenticated user can SELECT from gst_rate_rules'
);

select results_eq(
  'select count(*)::integer from public.rule_params where id = ''rp111111-1111-1111-1111-111111111111''',
  array[1],
  'Generic authenticated user can SELECT from rule_params'
);

-- Platform Admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "p0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'p0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Platform Admin can SELECT from gst_rate_rules'
);

select results_eq(
  'select count(*)::integer from public.rule_params where id = ''rp111111-1111-1111-1111-111111111111''',
  array[1],
  'Platform Admin can SELECT from rule_params'
);

-- Anonymous User Denied SELECT
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is_empty(
  'select * from public.gst_rate_rules',
  'Anonymous user CANNOT SELECT from gst_rate_rules (empty set)'
);

select is_empty(
  'select * from public.rule_params',
  'Anonymous user CANNOT SELECT from rule_params (empty set)'
);

-- 2.2 Regular Firm Staff CANNOT INSERT, UPDATE, or DELETE from gst_rate_rules
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  'insert into public.gst_rate_rules (hsn_prefix, rate, effective_from, source_ref, notes) values (''9999'', 18.00, ''2026-01-01'', ''Staff test'', ''Staff note'')',
  '42501',
  'Firm staff CANNOT INSERT into gst_rate_rules (throws 42501)'
);

update public.gst_rate_rules set notes = 'Hacked by staff' where id = 'r1111111-1111-1111-1111-111111111111';
select results_eq(
  'select notes from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array['Initial rule'::text],
  'Firm staff UPDATE on gst_rate_rules is denied (notes unchanged)'
);

delete from public.gst_rate_rules where id = 'r1111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm staff DELETE on gst_rate_rules is denied (row still exists)'
);

-- 2.3 Client Owner CANNOT INSERT, UPDATE, or DELETE from gst_rate_rules
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  'insert into public.gst_rate_rules (hsn_prefix, rate, effective_from, source_ref, notes) values (''9998'', 18.00, ''2026-01-01'', ''Client test'', ''Client note'')',
  '42501',
  'Client owner CANNOT INSERT into gst_rate_rules (throws 42501)'
);

update public.gst_rate_rules set notes = 'Hacked by client' where id = 'r1111111-1111-1111-1111-111111111111';
select results_eq(
  'select notes from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array['Initial rule'::text],
  'Client owner UPDATE on gst_rate_rules is denied (notes unchanged)'
);

delete from public.gst_rate_rules where id = 'r1111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*)::integer from public.gst_rate_rules where id = ''r1111111-1111-1111-1111-111111111111''',
  array[1],
  'Client owner DELETE on gst_rate_rules is denied (row still exists)'
);

-- 2.4 Platform Admin CAN INSERT and UPDATE gst_rate_rules
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "p0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'p0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  'insert into public.gst_rate_rules (id, hsn_prefix, rate, effective_from, source_ref, notes) values (''r2222222-2222-2222-2222-222222222222''::uuid, ''4820'', 18.00, ''2026-01-01'', ''Notification 01/2026'', ''Created by platform admin'')',
  'Platform admin CAN INSERT into gst_rate_rules'
);

select results_eq(
  'select hsn_prefix from public.gst_rate_rules where id = ''r2222222-2222-2222-2222-222222222222''',
  array['4820'::text],
  'Platform admin inserted rule is visible and confirmed'
);

select lives_ok(
  'update public.gst_rate_rules set rate = 5.00, notes = ''Updated by platform admin'' where id = ''r2222222-2222-2222-2222-222222222222''',
  'Platform admin CAN UPDATE gst_rate_rules'
);

select results_eq(
  'select rate::numeric from public.gst_rate_rules where id = ''r2222222-2222-2222-2222-222222222222''',
  array[5.00::numeric],
  'Platform admin updated rate is confirmed'
);

-- ============================================================================
-- 3. Audit Events Table Assertions (Tests 30-44)
-- ============================================================================

-- 3.1 Firm Admin can SELECT audit_events for their own firm
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select count(*)::integer from public.audit_events where firm_id = ''11111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Admin can SELECT audit_events for their own firm (Firm A)'
);

select is_empty(
  'select * from public.audit_events where firm_id = ''22222222-2222-2222-2222-222222222222''',
  'Firm Admin CANNOT SELECT audit_events for Firm B (empty set)'
);

select results_eq(
  'select count(*)::integer from public.audit_events',
  array[1],
  'Firm Admin sees only their own firm audit events (count = 1)'
);

-- 3.2 Firm Staff (non-admin) CANNOT SELECT audit_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is_empty(
  'select * from public.audit_events',
  'Firm Staff (non-admin) CANNOT SELECT audit_events (empty set)'
);

select results_eq(
  'select count(*)::integer from public.audit_events',
  array[0],
  'Firm Staff sees 0 audit_events'
);

-- 3.3 Client Owner CANNOT SELECT audit_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is_empty(
  'select * from public.audit_events',
  'Client Owner CANNOT SELECT audit_events (empty set)'
);

select results_eq(
  'select count(*)::integer from public.audit_events',
  array[0],
  'Client Owner sees 0 audit_events'
);

-- 3.4 Outsider CANNOT SELECT audit_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is_empty(
  'select * from public.audit_events',
  'Outsider CANNOT SELECT audit_events (empty set)'
);

-- 3.5 Append-Only Guarantee: NOBODY can UPDATE or DELETE audit_events (trigger throws exception)
-- Even when executed as superuser / postgres bypassing RLS, the row-level trigger strictly aborts.
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);

select throws_ok(
  'update public.audit_events set action = ''UPDATE'' where id = ''ae111111-1111-1111-1111-111111111111''',
  'audit_events is append-only: updates and deletes are prohibited',
  'Trigger throws append-only exception on UPDATE of audit_events by superuser'
);

select throws_ok(
  'delete from public.audit_events where id = ''ae111111-1111-1111-1111-111111111111''',
  'audit_events is append-only: updates and deletes are prohibited',
  'Trigger throws append-only exception on DELETE of audit_events by superuser'
);

-- Firm Admin attempt to mutate audit_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.audit_events set action = 'UPDATE' where id = 'ae111111-1111-1111-1111-111111111111';
select results_eq(
  'select action from public.audit_events where id = ''ae111111-1111-1111-1111-111111111111''',
  array['INSERT'::text],
  'Firm Admin cannot UPDATE audit_events (action remains INSERT)'
);

delete from public.audit_events where id = 'ae111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*)::integer from public.audit_events where id = ''ae111111-1111-1111-1111-111111111111''',
  array[1],
  'Firm Admin cannot DELETE audit_events (row still exists)'
);

-- Platform Admin attempt to mutate audit_events
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "p0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'p0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.audit_events set action = 'UPDATE' where id = 'ae111111-1111-1111-1111-111111111111';
select results_eq(
  'select action from public.audit_events where id = ''ae111111-1111-1111-1111-111111111111''',
  array['INSERT'::text],
  'Platform Admin cannot UPDATE audit_events (action remains INSERT)'
);

delete from public.audit_events where id = 'ae111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*)::integer from public.audit_events where id = ''ae111111-1111-1111-1111-111111111111''',
  array[1],
  'Platform Admin cannot DELETE audit_events (row still exists)'
);

-- Direct trigger function check
select throws_ok(
  'select public.prevent_audit_modification()',
  'audit_events is append-only: updates and deletes are prohibited',
  'Direct execution of prevent_audit_modification() throws exception'
);

-- ============================================================================
-- 4. Storage Policies Assertions (Tests 45-58)
-- ============================================================================

-- 4.1 Storage Path Isolation: Firm A user can access objects in {firm_A_id}/..., but cannot access {firm_B_id}/...
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select name from storage.objects where id = ''so111111-1111-1111-1111-111111111111''',
  array['11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/doc1/bill1.pdf'::text],
  'Firm A user can access objects in firm A path (Client 1)'
);

select results_eq(
  'select name from storage.objects where id = ''so111111-1111-1111-1111-222222222222''',
  array['11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/doc2/bill2.pdf'::text],
  'Firm A user can access objects in firm A path (Client 2)'
);

select is_empty(
  'select * from storage.objects where id = ''so222222-2222-2222-2222-333333333333''',
  'Firm A user CANNOT access objects in Firm B storage path (empty set)'
);

select results_eq(
  'select count(*)::integer from storage.objects where bucket_id = ''documents'' and id in (''so111111-1111-1111-1111-111111111111'', ''so111111-1111-1111-1111-222222222222'', ''so222222-2222-2222-2222-333333333333'')',
  array[2],
  'Firm A user sees exactly 2 objects belonging to Firm A'
);

select lives_ok(
  'insert into storage.objects (id, bucket_id, name) values (''so111111-9999-1111-1111-111111111111''::uuid, ''documents'', ''11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/doc_new/new.pdf'')',
  'Firm A user CAN INSERT object into Firm A storage path'
);

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''so222222-9999-2222-2222-222222222222''::uuid, ''documents'', ''22222222-2222-2222-2222-222222222222/cccccccc-cccc-cccc-cccc-cccccccccccc/doc_hack/hack.pdf'')',
  '42501',
  'Firm A user CANNOT INSERT object into Firm B storage path (throws 42501)'
);

-- 4.2 Client Owner can access {firm_A_id}/{client_A_id}/..., but cannot access other client paths
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  'select name from storage.objects where id = ''so111111-1111-1111-1111-111111111111''',
  array['11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/doc1/bill1.pdf'::text],
  'Client 1 Owner can access objects in {firm_A_id}/{client_1_id}/...'
);

select is_empty(
  'select * from storage.objects where id = ''so111111-1111-1111-1111-222222222222''',
  'Client 1 Owner CANNOT access objects of other client under same firm'
);

select is_empty(
  'select * from storage.objects where id = ''so222222-2222-2222-2222-333333333333''',
  'Client 1 Owner CANNOT access objects of client under different firm'
);

select results_eq(
  'select count(*)::integer from storage.objects where bucket_id = ''documents'' and id in (''so111111-1111-1111-1111-111111111111'', ''so111111-1111-1111-1111-222222222222'', ''so222222-2222-2222-2222-333333333333'')',
  array[1],
  'Client 1 Owner sees only their own client objects (count = 1)'
);

select lives_ok(
  'insert into storage.objects (id, bucket_id, name) values (''so111111-8888-1111-1111-111111111111''::uuid, ''documents'', ''11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/doc_client/upload.pdf'')',
  'Client owner CAN INSERT object into own client path'
);

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''so111111-8888-1111-1111-222222222222''::uuid, ''documents'', ''11111111-1111-1111-1111-111111111111/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/doc_hack/hack.pdf'')',
  '42501',
  'Client owner CANNOT INSERT object into another client path under same firm (throws 42501)'
);

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''so222222-8888-2222-2222-333333333333''::uuid, ''documents'', ''22222222-2222-2222-2222-222222222222/cccccccc-cccc-cccc-cccc-cccccccccccc/doc_hack/hack.pdf'')',
  '42501',
  'Client owner CANNOT INSERT object into client path under different firm (throws 42501)'
);

-- 4.3 Anonymous User Storage Isolation
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is_empty(
  'select * from storage.objects where bucket_id = ''documents''',
  'Anonymous user CANNOT access any documents in storage'
);

-- Finish pgTAP Test Suite
select * from finish();

rollback;
