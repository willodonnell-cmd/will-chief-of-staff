create table if not exists public.investment_committee_agent_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject text not null,
  raw_email_body text not null,
  envelope jsonb not null,
  source_message_id text,
  produced_at timestamptz not null,
  week_of date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_investment_committee_agent_bundles_user_produced
  on public.investment_committee_agent_bundles(user_id, produced_at desc, created_at desc);

create index if not exists idx_investment_committee_agent_bundles_user_week
  on public.investment_committee_agent_bundles(user_id, week_of desc);

create unique index if not exists idx_investment_committee_agent_bundles_user_source_message
  on public.investment_committee_agent_bundles(user_id, source_message_id);

drop trigger if exists set_investment_committee_agent_bundles_updated_at on public.investment_committee_agent_bundles;
create trigger set_investment_committee_agent_bundles_updated_at
before update on public.investment_committee_agent_bundles
for each row
execute function public.set_updated_at();

alter table public.investment_committee_agent_bundles enable row level security;

drop policy if exists investment_committee_agent_bundles_select_own on public.investment_committee_agent_bundles;
create policy investment_committee_agent_bundles_select_own
on public.investment_committee_agent_bundles
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists investment_committee_agent_bundles_insert_own on public.investment_committee_agent_bundles;
create policy investment_committee_agent_bundles_insert_own
on public.investment_committee_agent_bundles
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists investment_committee_agent_bundles_update_own on public.investment_committee_agent_bundles;
create policy investment_committee_agent_bundles_update_own
on public.investment_committee_agent_bundles
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists investment_committee_agent_bundles_delete_own on public.investment_committee_agent_bundles;
create policy investment_committee_agent_bundles_delete_own
on public.investment_committee_agent_bundles
for delete
to authenticated
using (user_id = app_private.current_user_id());
