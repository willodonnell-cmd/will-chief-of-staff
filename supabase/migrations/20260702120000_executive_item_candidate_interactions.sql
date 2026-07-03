create table if not exists public.executive_item_candidate_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  candidate_id text not null,
  interaction_key text not null,
  source_type text not null check (
    source_type in ('investment_committee', 'executive_brief', 'meeting', 'topic', 'manual', 'task', 'unknown')
  ),
  source_id text not null,
  action text not null check (action in ('dismissed', 'snoozed', 'reviewed')),
  snoozed_until timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, interaction_key)
);

create index if not exists idx_executive_item_candidate_interactions_user_action
  on public.executive_item_candidate_interactions(user_id, action, snoozed_until);

create index if not exists idx_executive_item_candidate_interactions_user_source
  on public.executive_item_candidate_interactions(user_id, source_type, source_id);

drop trigger if exists set_executive_item_candidate_interactions_updated_at on public.executive_item_candidate_interactions;
create trigger set_executive_item_candidate_interactions_updated_at
before update on public.executive_item_candidate_interactions
for each row
execute function public.set_updated_at();

alter table public.executive_item_candidate_interactions enable row level security;

drop policy if exists executive_item_candidate_interactions_select_own on public.executive_item_candidate_interactions;
create policy executive_item_candidate_interactions_select_own
on public.executive_item_candidate_interactions
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists executive_item_candidate_interactions_insert_own on public.executive_item_candidate_interactions;
create policy executive_item_candidate_interactions_insert_own
on public.executive_item_candidate_interactions
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists executive_item_candidate_interactions_update_own on public.executive_item_candidate_interactions;
create policy executive_item_candidate_interactions_update_own
on public.executive_item_candidate_interactions
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists executive_item_candidate_interactions_delete_own on public.executive_item_candidate_interactions;
create policy executive_item_candidate_interactions_delete_own
on public.executive_item_candidate_interactions
for delete
to authenticated
using (user_id = app_private.current_user_id());
