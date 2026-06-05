alter table public.agent_signal_runs
  drop constraint if exists agent_signal_runs_producer_check;

alter table public.agent_signal_runs
  add constraint agent_signal_runs_producer_check
    check (producer in ('chatgpt_agent', 'blackhawk_native'));

create table if not exists public.microsoft_graph_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tenant_id text,
  microsoft_user_id text,
  email text,
  display_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}'::text[],
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_microsoft_graph_connections_user
  on public.microsoft_graph_connections(user_id);

create index if not exists idx_microsoft_graph_connections_user_revoked
  on public.microsoft_graph_connections(user_id, revoked_at);

create index if not exists idx_microsoft_graph_connections_expires_at
  on public.microsoft_graph_connections(expires_at);

create unique index if not exists idx_microsoft_graph_connections_one_active_per_user
  on public.microsoft_graph_connections(user_id)
  where revoked_at is null;

drop trigger if exists set_microsoft_graph_connections_updated_at on public.microsoft_graph_connections;
create trigger set_microsoft_graph_connections_updated_at
before update on public.microsoft_graph_connections
for each row
execute function public.set_updated_at();

alter table public.microsoft_graph_connections enable row level security;

revoke all on table public.microsoft_graph_connections from anon, authenticated;
grant select (
  id,
  user_id,
  tenant_id,
  microsoft_user_id,
  email,
  display_name,
  expires_at,
  scopes,
  connected_at,
  last_refreshed_at,
  revoked_at,
  created_at,
  updated_at
) on public.microsoft_graph_connections to authenticated;

drop policy if exists microsoft_graph_connections_select_own_metadata on public.microsoft_graph_connections;
create policy microsoft_graph_connections_select_own_metadata
on public.microsoft_graph_connections
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists microsoft_graph_connections_insert_own on public.microsoft_graph_connections;
create policy microsoft_graph_connections_insert_own
on public.microsoft_graph_connections
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists microsoft_graph_connections_update_own on public.microsoft_graph_connections;
create policy microsoft_graph_connections_update_own
on public.microsoft_graph_connections
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists microsoft_graph_connections_delete_own on public.microsoft_graph_connections;
create policy microsoft_graph_connections_delete_own
on public.microsoft_graph_connections
for delete
to authenticated
using (user_id = app_private.current_user_id());
