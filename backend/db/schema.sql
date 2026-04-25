-- ReceiptMind Supabase schema
-- Run this in the Supabase SQL editor after creating the project.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) unique not null,
  password_hash varchar(255) not null,
  name varchar(255),
  role varchar(50) not null default 'user',
  avatar_url text,
  company_name varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash varchar(255) not null,
  expires_at timestamptz not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  filename varchar(255) not null,
  file_url text not null,
  file_size bigint,
  mime_type varchar(100),
  status varchar(50) not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  vendor_name varchar(255),
  amount numeric(10,2),
  currency varchar(3) not null default 'USD',
  receipt_date date,
  category varchar(100),
  description text,
  raw_ocr_text text,
  confidence numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  receipt_id uuid references public.receipts(id) on delete set null,
  vendor_name varchar(255) not null,
  amount numeric(10,2) not null,
  currency varchar(3) not null default 'USD',
  expense_date date not null,
  category varchar(100),
  description text,
  status varchar(50) not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'synced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key_hash varchar(255) not null,
  name varchar(255) not null,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action varchar(100) not null,
  resource_id varchar(255),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_receipts_user_id on public.receipts(user_id);
create index if not exists idx_receipts_created_at on public.receipts(created_at desc);
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_expense_date on public.expenses(expense_date desc);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_expires_at on public.sessions(expires_at);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists receipts_set_updated_at on public.receipts;
create trigger receipts_set_updated_at before update on public.receipts for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.receipts enable row level security;
alter table public.expenses enable row level security;
alter table public.api_keys enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "users_own_data_select" on public.users;
create policy "users_own_data_select" on public.users for select using (id::text = auth.uid()::text);
drop policy if exists "users_own_data_update" on public.users;
create policy "users_own_data_update" on public.users for update using (id::text = auth.uid()::text);

drop policy if exists "sessions_own_data" on public.sessions;
create policy "sessions_own_data" on public.sessions for all using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);

drop policy if exists "receipts_own_data" on public.receipts;
create policy "receipts_own_data" on public.receipts for all using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);

drop policy if exists "expenses_own_data" on public.expenses;
create policy "expenses_own_data" on public.expenses for all using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);

drop policy if exists "api_keys_own_data" on public.api_keys;
create policy "api_keys_own_data" on public.api_keys for all using (user_id::text = auth.uid()::text) with check (user_id::text = auth.uid()::text);

drop policy if exists "audit_logs_own_data" on public.audit_logs;
create policy "audit_logs_own_data" on public.audit_logs for select using (user_id::text = auth.uid()::text);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipt-files',
  'receipt-files',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipt_files_authenticated_select" on storage.objects;
create policy "receipt_files_authenticated_select"
on storage.objects
for select
using (bucket_id = 'receipt-files' and auth.role() = 'authenticated');

drop policy if exists "receipt_files_service_role_insert" on storage.objects;
create policy "receipt_files_service_role_insert"
on storage.objects
for insert
with check (bucket_id = 'receipt-files' and auth.role() = 'service_role');

drop policy if exists "receipt_files_service_role_update" on storage.objects;
create policy "receipt_files_service_role_update"
on storage.objects
for update
using (bucket_id = 'receipt-files' and auth.role() = 'service_role');

drop policy if exists "receipt_files_service_role_delete" on storage.objects;
create policy "receipt_files_service_role_delete"
on storage.objects
for delete
using (bucket_id = 'receipt-files' and auth.role() = 'service_role');
