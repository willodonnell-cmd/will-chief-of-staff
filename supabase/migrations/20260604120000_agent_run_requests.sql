create table if not exists public.agent_run_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  request_type text not null default 'manual'
    check (request_type in ('manual')),
  status text not null default 'requested'
    check (status in ('requested', 'claimed', 'completed', 'failed', 'expired', 'cancelled')),
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  agent_signal_run_id uuid references public.agent_signal_runs(id) on delete set null,
  requested_by text,
  request_context jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_run_requests_user_status_requested_at
  on public.agent_run_requests(user_id, status, requested_at desc);

create index if not exists idx_agent_run_requests_status_expires_at
  on public.agent_run_requests(status, expires_at);

create index if not exists idx_agent_run_requests_agent_signal_run
  on public.agent_run_requests(agent_signal_run_id)
  where agent_signal_run_id is not null;

drop trigger if exists set_agent_run_requests_updated_at on public.agent_run_requests;
create trigger set_agent_run_requests_updated_at
before update on public.agent_run_requests
for each row
execute function public.set_updated_at();

alter table public.agent_signal_runs
  add column if not exists agent_run_request_id uuid references public.agent_run_requests(id) on delete set null;

create index if not exists idx_agent_signal_runs_agent_run_request
  on public.agent_signal_runs(agent_run_request_id)
  where agent_run_request_id is not null;

alter table public.agent_run_requests enable row level security;

drop policy if exists agent_run_requests_select_own on public.agent_run_requests;
create policy agent_run_requests_select_own
on public.agent_run_requests
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists agent_run_requests_insert_own on public.agent_run_requests;
create policy agent_run_requests_insert_own
on public.agent_run_requests
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists agent_run_requests_update_own on public.agent_run_requests;
create policy agent_run_requests_update_own
on public.agent_run_requests
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists agent_run_requests_delete_own on public.agent_run_requests;
create policy agent_run_requests_delete_own
on public.agent_run_requests
for delete
to authenticated
using (user_id = app_private.current_user_id());
