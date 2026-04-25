-- ============================================================
-- RECEIPTMIND DATABASE SCHEMA
-- Supabase PostgreSQL / Option A foundation
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- HELPERS
-- ============================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_my_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team', 'firm')),
  plan_interval text not null default 'monthly' check (plan_interval in ('monthly', 'yearly')),
  stripe_customer_id text,
  stripe_subscription_id text,
  receipt_count_this_month int not null default 0,
  receipt_limit int not null default 10,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. USERS (extends auth.users)
-- ============================================================

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'viewer', 'accountant')),
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_users_email_unique on public.users(email);
create index if not exists idx_users_organization_id on public.users(organization_id);

-- ============================================================
-- 3. CLIENTS
-- ============================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  email_inbox text unique,
  currency text not null default 'USD',
  country text not null default 'US',
  tax_year_end text not null default '12-31',
  qbo_realm_id text,
  xero_tenant_id text,
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_organization_id on public.clients(organization_id);
create index if not exists idx_clients_active on public.clients(organization_id, is_active);

-- ============================================================
-- 4. BANK TRANSACTIONS
-- ============================================================

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  external_id text unique,
  account_id text,
  account_name text,
  account_mask text,
  amount decimal(12,2) not null,
  currency text not null default 'USD',
  transaction_date date not null,
  description text,
  merchant_name text,
  merchant_category text,
  status text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  matched_receipt_id uuid,
  plaid_transaction_id text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bank_transactions_org on public.bank_transactions(organization_id);
create index if not exists idx_bank_transactions_external on public.bank_transactions(external_id);
create index if not exists idx_bank_transactions_status on public.bank_transactions(organization_id, status);

-- ============================================================
-- 5. RECEIPTS
-- ============================================================

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  uploaded_by uuid references public.users(id) on delete set null,
  file_url text not null,
  file_name text,
  file_type text check (file_type in ('pdf', 'jpg', 'png', 'heic', 'webp')),
  file_size_bytes int,
  file_hash text,
  vendor_name text,
  vendor_normalized text,
  amount decimal(12,2),
  tax_amount decimal(12,2),
  currency text not null default 'USD',
  receipt_date date,
  description text,
  line_items jsonb not null default '[]'::jsonb,
  category text,
  subcategory text,
  tax_code text,
  is_billable boolean not null default false,
  is_reimbursable boolean not null default false,
  extraction_confidence decimal(3,2),
  categorization_confidence decimal(3,2),
  needs_review boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'extracting', 'extracted', 'categorized', 'matched', 'approved', 'posted', 'rejected', 'error')),
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  match_confidence decimal(3,2),
  match_method text check (match_method in ('auto', 'manual', 'rule')),
  qbo_expense_id text,
  xero_expense_id text,
  posted_at timestamptz,
  posted_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  source text not null default 'upload' check (source in ('upload', 'email', 'gmail_api', 'mobile')),
  source_email_id text,
  raw_extraction jsonb not null default '{}'::jsonb,
  user_corrections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bank_transactions
  drop constraint if exists bank_transactions_matched_receipt_id_fkey;

alter table public.bank_transactions
  add constraint bank_transactions_matched_receipt_id_fkey
  foreign key (matched_receipt_id) references public.receipts(id) on delete set null;

create index if not exists idx_receipts_org_id on public.receipts(organization_id);
create index if not exists idx_receipts_org_created on public.receipts(organization_id, created_at desc);
create index if not exists idx_receipts_status on public.receipts(status);
create index if not exists idx_receipts_vendor on public.receipts(vendor_normalized);
create index if not exists idx_receipts_date on public.receipts(receipt_date);
create index if not exists idx_receipts_needs_review on public.receipts(organization_id, needs_review) where needs_review = true;
create index if not exists idx_receipts_file_hash on public.receipts(file_hash);

-- ============================================================
-- 6. CATEGORY RULES
-- ============================================================

create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  priority int not null default 0,
  condition_vendor text,
  condition_amount_min decimal(12,2),
  condition_amount_max decimal(12,2),
  condition_description_contains text,
  action_category text not null,
  action_subcategory text,
  action_tax_code text,
  action_is_billable boolean,
  action_is_reimbursable boolean,
  action_notes text,
  is_active boolean not null default true,
  times_applied int not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rules_org_priority on public.category_rules(organization_id, priority desc);
create index if not exists idx_rules_vendor on public.category_rules(condition_vendor);

-- ============================================================
-- 7. EXCEPTIONS
-- ============================================================

create table if not exists public.exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  receipt_id uuid references public.receipts(id) on delete cascade,
  type text not null check (type in ('low_confidence', 'duplicate_suspected', 'amount_anomaly', 'missing_date', 'missing_vendor', 'policy_violation', 'unmatched_transaction', 'missing_receipt')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  description text not null,
  suggested_action text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_exceptions_org_status on public.exceptions(organization_id, status);
create index if not exists idx_exceptions_receipt_id on public.exceptions(receipt_id);

-- ============================================================
-- 8. EMAIL INBOXES
-- ============================================================

create table if not exists public.email_inboxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  email_address text unique not null,
  is_active boolean not null default true,
  last_received_at timestamptz,
  total_received int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_inboxes_org on public.email_inboxes(organization_id);

-- ============================================================
-- 9. INTEGRATIONS
-- ============================================================

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  provider text not null check (provider in ('qbo', 'xero', 'gmail', 'plaid', 'freshbooks')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error', 'expired')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  provider_company_id text,
  provider_company_name text,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_count int not null default 0,
  last_sync_error text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_integrations_org_client_provider on public.integrations(organization_id, client_id, provider);

-- ============================================================
-- 10. TEAM INVITES & APPROVALS
-- ============================================================

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inviter_id uuid references public.users(id) on delete set null,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer', 'accountant')),
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_id uuid references public.receipts(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'auto_approved')),
  notes text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 11. MILEAGE LOGS
-- ============================================================

create table if not exists public.mileage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  trip_date date not null,
  start_location text,
  end_location text,
  distance_miles decimal(8,2),
  distance_km decimal(8,2),
  purpose text,
  is_billable boolean not null default false,
  rate_per_mile decimal(6,4),
  total_deductible decimal(10,2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'posted')),
  qbo_expense_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 12. SHARE LINKS
-- ============================================================

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  token text unique not null,
  name text,
  expires_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 13. AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org_created on public.audit_logs(organization_id, created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists update_organizations_updated_at on public.organizations;
create trigger update_organizations_updated_at before update on public.organizations for each row execute function public.update_updated_at();

drop trigger if exists update_users_updated_at on public.users;
create trigger update_users_updated_at before update on public.users for each row execute function public.update_updated_at();

drop trigger if exists update_clients_updated_at on public.clients;
create trigger update_clients_updated_at before update on public.clients for each row execute function public.update_updated_at();

drop trigger if exists update_bank_transactions_updated_at on public.bank_transactions;
create trigger update_bank_transactions_updated_at before update on public.bank_transactions for each row execute function public.update_updated_at();

drop trigger if exists update_receipts_updated_at on public.receipts;
create trigger update_receipts_updated_at before update on public.receipts for each row execute function public.update_updated_at();

drop trigger if exists update_category_rules_updated_at on public.category_rules;
create trigger update_category_rules_updated_at before update on public.category_rules for each row execute function public.update_updated_at();

drop trigger if exists update_integrations_updated_at on public.integrations;
create trigger update_integrations_updated_at before update on public.integrations for each row execute function public.update_updated_at();

drop trigger if exists update_mileage_logs_updated_at on public.mileage_logs;
create trigger update_mileage_logs_updated_at before update on public.mileage_logs for each row execute function public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.receipts enable row level security;
alter table public.category_rules enable row level security;
alter table public.exceptions enable row level security;
alter table public.email_inboxes enable row level security;
alter table public.integrations enable row level security;
alter table public.team_invites enable row level security;
alter table public.approval_requests enable row level security;
alter table public.mileage_logs enable row level security;
alter table public.share_links enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "organizations_select_own_org" on public.organizations;
create policy "organizations_select_own_org" on public.organizations
for select using (id = public.get_my_organization_id());

drop policy if exists "organizations_update_own_org" on public.organizations;
create policy "organizations_update_own_org" on public.organizations
for update using (id = public.get_my_organization_id());

drop policy if exists "users_view_own_org" on public.users;
create policy "users_view_own_org" on public.users
for select using (organization_id = public.get_my_organization_id());

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
for update using (id = auth.uid());

drop policy if exists "clients_own_org" on public.clients;
create policy "clients_own_org" on public.clients
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "bank_transactions_own_org" on public.bank_transactions;
create policy "bank_transactions_own_org" on public.bank_transactions
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "receipts_own_org" on public.receipts;
create policy "receipts_own_org" on public.receipts
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "category_rules_own_org" on public.category_rules;
create policy "category_rules_own_org" on public.category_rules
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "exceptions_own_org" on public.exceptions;
create policy "exceptions_own_org" on public.exceptions
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "email_inboxes_own_org" on public.email_inboxes;
create policy "email_inboxes_own_org" on public.email_inboxes
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "integrations_own_org" on public.integrations;
create policy "integrations_own_org" on public.integrations
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "team_invites_own_org" on public.team_invites;
create policy "team_invites_own_org" on public.team_invites
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "approval_requests_own_org" on public.approval_requests;
create policy "approval_requests_own_org" on public.approval_requests
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "mileage_logs_own_org" on public.mileage_logs;
create policy "mileage_logs_own_org" on public.mileage_logs
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "share_links_own_org" on public.share_links;
create policy "share_links_own_org" on public.share_links
for all using (organization_id = public.get_my_organization_id())
with check (organization_id = public.get_my_organization_id());

drop policy if exists "audit_logs_own_org" on public.audit_logs;
create policy "audit_logs_own_org" on public.audit_logs
for select using (organization_id = public.get_my_organization_id());

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload receipts" on storage.objects;
create policy "Users can upload receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can view own receipts" on storage.objects;
create policy "Users can view own receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own receipts" on storage.objects;
create policy "Users can delete own receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  base_slug text;
begin
  base_slug := regexp_replace(lower(coalesce(new.raw_user_meta_data->>'company_name', split_part(new.email, '@', 1))), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then
    base_slug := gen_random_uuid()::text;
  end if;

  insert into public.organizations (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', 'My Company'),
    base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  )
  returning id into new_org_id;

  insert into public.users (id, organization_id, email, full_name, role)
  values (
    new.id,
    new_org_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function public.get_remaining_free_receipts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  user_limit int;
  used_this_month int;
begin
  select receipt_limit
  into user_limit
  from public.organizations
  where id = public.get_my_organization_id();

  select count(*)
  into used_this_month
  from public.receipts
  where organization_id = public.get_my_organization_id()
    and date_trunc('month', created_at) = date_trunc('month', now());

  return greatest(0, coalesce(user_limit, 10) - coalesce(used_this_month, 0));
end;
$$;

create or replace function public.check_duplicate_receipt(
  p_vendor text,
  p_amount decimal,
  p_date date,
  p_file_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  match_count int;
begin
  select count(*)
  into match_count
  from public.receipts
  where organization_id = public.get_my_organization_id()
    and (
      (p_file_hash is not null and file_hash = p_file_hash)
      or (
        vendor_normalized = p_vendor
        and amount = p_amount
        and receipt_date between (p_date - 3) and (p_date + 3)
      )
    );

  return match_count > 0;
end;
$$;
