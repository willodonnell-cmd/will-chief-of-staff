create table if not exists public.priority_inbox_source_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null check (source in ('outlook', 'gmail', 'teams')),
  connection_status text not null default 'disconnected' check (connection_status in ('disconnected', 'connected', 'needs_reauth', 'error')),
  external_account_id text,
  external_account_email text,
  external_account_label text,
  delegated_scopes text[] not null default '{}'::text[],
  token_access_ciphertext text,
  token_refresh_ciphertext text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_sync_started_at timestamptz,
  last_sync_status text not null default 'idle' check (last_sync_status in ('idle', 'success', 'error')),
  last_sync_error text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);

alter table public.priority_inbox_items
  add column if not exists external_message_id text,
  add column if not exists external_thread_id text,
  add column if not exists received_at timestamptz,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_priority_inbox_items_user_source_external_message
  on public.priority_inbox_items(user_id, source, external_message_id);

create index if not exists idx_priority_inbox_items_user_source_received_at
  on public.priority_inbox_items(user_id, source, received_at desc)
  where received_at is not null;

create index if not exists idx_priority_inbox_source_connections_user_source
  on public.priority_inbox_source_connections(user_id, source);

drop trigger if exists set_priority_inbox_source_connections_updated_at on public.priority_inbox_source_connections;
create trigger set_priority_inbox_source_connections_updated_at
before update on public.priority_inbox_source_connections
for each row
execute function public.set_updated_at();

alter table public.priority_inbox_source_connections enable row level security;

drop policy if exists priority_inbox_source_connections_select_own on public.priority_inbox_source_connections;
create policy priority_inbox_source_connections_select_own
on public.priority_inbox_source_connections
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_source_connections_insert_own on public.priority_inbox_source_connections;
create policy priority_inbox_source_connections_insert_own
on public.priority_inbox_source_connections
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_source_connections_update_own on public.priority_inbox_source_connections;
create policy priority_inbox_source_connections_update_own
on public.priority_inbox_source_connections
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_source_connections_delete_own on public.priority_inbox_source_connections;
create policy priority_inbox_source_connections_delete_own
on public.priority_inbox_source_connections
for delete
to authenticated
using (user_id = app_private.current_user_id());
