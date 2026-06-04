create table if not exists public.agent_signal_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  producer text not null check (producer in ('chatgpt_agent')),
  connector_family text not null check (connector_family in ('microsoft_365')),
  tenant_label text not null,
  run_status text not null check (run_status in ('succeeded', 'failed')),
  sources_checked text[] not null default '{}'::text[],
  source_coverage jsonb not null default '{}'::jsonb,
  window_start timestamptz,
  window_end timestamptz,
  produced_at timestamptz not null,
  completed_at timestamptz not null default now(),
  total_submitted_signal_count integer not null default 0,
  accepted_signal_count integer not null default 0,
  investment_committee_routed_count integer not null default 0,
  suppressed_meta_admin_count integer not null default 0,
  suppressed_low_signal_count integer not null default 0,
  rejected_invalid_count integer not null default 0,
  error_message text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_signal_runs_user_completed_at_desc
  on public.agent_signal_runs(user_id, completed_at desc);

create index if not exists idx_agent_signal_runs_user_status_completed_at_desc
  on public.agent_signal_runs(user_id, run_status, completed_at desc);

drop trigger if exists set_agent_signal_runs_updated_at on public.agent_signal_runs;
create trigger set_agent_signal_runs_updated_at
before update on public.agent_signal_runs
for each row
execute function public.set_updated_at();

alter table public.source_items
  add column if not exists user_id uuid references public.users(id) on delete cascade;

update public.source_items
set user_id = '11111111-1111-1111-1111-111111111111'
where user_id is null;

alter table public.source_items
  alter column user_id set not null;

alter table public.source_items
  drop constraint if exists source_items_source_system_source_type_external_id_key;

alter table public.source_items
  add constraint source_items_user_source_external_key
  unique (user_id, source_system, source_type, external_id);

alter table public.agent_signals
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists run_id uuid references public.agent_signal_runs(id) on delete set null,
  add column if not exists category text,
  add column if not exists why_it_matters text,
  add column if not exists source_reference text,
  add column if not exists routing_outcome text,
  add column if not exists routing_reason text,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb;

update public.agent_signals
set user_id = '11111111-1111-1111-1111-111111111111'
where user_id is null;

update public.agent_signals
set routing_outcome = case
  when lower(coalesce(category, '')) in ('ic', 'investment committee', 'investment_committee')
    then 'investment_committee'
  else 'priority_inbox'
end
where routing_outcome is null;

alter table public.agent_signals
  alter column user_id set not null;

alter table public.agent_signals
  drop constraint if exists agent_signals_external_signal_id_key,
  drop constraint if exists agent_signals_import_source_mode_check,
  drop constraint if exists agent_signals_routing_outcome_check;

alter table public.agent_signals
  add constraint agent_signals_user_external_signal_key
    unique (user_id, external_signal_id),
  add constraint agent_signals_import_source_mode_check
    check (import_source_mode in ('database', 'agent_run', 'fixture_dev')),
  add constraint agent_signals_routing_outcome_check
    check (routing_outcome in (
      'priority_inbox',
      'investment_committee',
      'suppressed_meta_admin',
      'suppressed_low_signal',
      'rejected_invalid'
    ));

create index if not exists idx_agent_signals_user_run
  on public.agent_signals(user_id, run_id, imported_at desc);

create index if not exists idx_agent_signals_user_routing_outcome
  on public.agent_signals(user_id, routing_outcome, imported_at desc);

alter table public.priority_inbox_items
  add column if not exists agent_signal_id uuid references public.agent_signals(id) on delete set null,
  add column if not exists agent_run_id uuid references public.agent_signal_runs(id) on delete set null;

update public.priority_inbox_items
set source_family = 'email'
where source = 'outlook'
  and source_family is distinct from 'email';

update public.priority_inbox_items
set source_family = 'teams'
where source = 'teams'
  and source_family is distinct from 'teams';

alter table public.priority_inbox_items
  drop constraint if exists priority_inbox_items_source_check,
  drop constraint if exists priority_inbox_items_source_family_check,
  drop constraint if exists priority_inbox_items_ingestion_mode_check;

alter table public.priority_inbox_items
  add constraint priority_inbox_items_source_check
    check (source in ('outlook', 'gmail', 'teams', 'calendar', 'manual', 'forwarded_email')),
  add constraint priority_inbox_items_source_family_check
    check (source_family in ('email', 'teams', 'calendar', 'manual')),
  add constraint priority_inbox_items_ingestion_mode_check
    check (ingestion_mode in ('live_adapter', 'forwarded', 'manual', 'agent_run'));

create unique index if not exists idx_priority_inbox_items_user_agent_signal
  on public.priority_inbox_items(user_id, agent_signal_id)
  where agent_signal_id is not null;

create index if not exists idx_priority_inbox_items_agent_run
  on public.priority_inbox_items(user_id, agent_run_id, visible_state, last_changed_at desc)
  where agent_run_id is not null;

alter table public.priority_inbox_events
  drop constraint if exists priority_inbox_events_source_check;

alter table public.priority_inbox_events
  add constraint priority_inbox_events_source_check
    check (source in ('outlook', 'gmail', 'teams', 'calendar', 'manual', 'forwarded_email'));

alter table public.agent_signal_runs enable row level security;
alter table public.source_items enable row level security;
alter table public.agent_signals enable row level security;

drop policy if exists agent_signal_runs_select_own on public.agent_signal_runs;
create policy agent_signal_runs_select_own
on public.agent_signal_runs
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists agent_signal_runs_insert_own on public.agent_signal_runs;
create policy agent_signal_runs_insert_own
on public.agent_signal_runs
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists agent_signal_runs_update_own on public.agent_signal_runs;
create policy agent_signal_runs_update_own
on public.agent_signal_runs
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists agent_signal_runs_delete_own on public.agent_signal_runs;
create policy agent_signal_runs_delete_own
on public.agent_signal_runs
for delete
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists source_items_select_own on public.source_items;
create policy source_items_select_own
on public.source_items
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists source_items_insert_own on public.source_items;
create policy source_items_insert_own
on public.source_items
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists source_items_update_own on public.source_items;
create policy source_items_update_own
on public.source_items
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists source_items_delete_own on public.source_items;
create policy source_items_delete_own
on public.source_items
for delete
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists agent_signals_select_own on public.agent_signals;
create policy agent_signals_select_own
on public.agent_signals
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists agent_signals_insert_own on public.agent_signals;
create policy agent_signals_insert_own
on public.agent_signals
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists agent_signals_update_own on public.agent_signals;
create policy agent_signals_update_own
on public.agent_signals
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists agent_signals_delete_own on public.agent_signals;
create policy agent_signals_delete_own
on public.agent_signals
for delete
to authenticated
using (user_id = app_private.current_user_id());
