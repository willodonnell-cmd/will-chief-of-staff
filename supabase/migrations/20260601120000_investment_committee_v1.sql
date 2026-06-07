create table if not exists public.investment_committee_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week_of date not null,
  box_link text,
  memo_due_at timestamptz,
  questions_due_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.investment_committee_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_id uuid not null references public.investment_committee_cycles(id) on delete cascade,
  title text not null,
  memo_link text,
  sponsor text,
  status text not null default 'not_started' check (
    status in ('not_started', 'reviewing', 'reviewed', 'questions_drafted', 'questions_sent')
  ),
  question_notes text,
  peer_question_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_investment_committee_cycles_user_week
  on public.investment_committee_cycles(user_id, week_of desc);

create index if not exists idx_investment_committee_cycles_user_status_week
  on public.investment_committee_cycles(user_id, status, week_of desc);

create index if not exists idx_investment_committee_cycles_active
  on public.investment_committee_cycles(user_id, archived_at, deleted_at);

create index if not exists idx_investment_committee_deals_cycle_sort
  on public.investment_committee_deals(cycle_id, sort_order, created_at);

create index if not exists idx_investment_committee_deals_user_status
  on public.investment_committee_deals(user_id, status, updated_at desc);

create index if not exists idx_investment_committee_deals_active
  on public.investment_committee_deals(user_id, archived_at, deleted_at);

drop trigger if exists set_investment_committee_cycles_updated_at on public.investment_committee_cycles;
create trigger set_investment_committee_cycles_updated_at
before update on public.investment_committee_cycles
for each row
execute function public.set_updated_at();

drop trigger if exists set_investment_committee_deals_updated_at on public.investment_committee_deals;
create trigger set_investment_committee_deals_updated_at
before update on public.investment_committee_deals
for each row
execute function public.set_updated_at();

alter table public.investment_committee_cycles enable row level security;
alter table public.investment_committee_deals enable row level security;

drop policy if exists investment_committee_cycles_select_own on public.investment_committee_cycles;
create policy investment_committee_cycles_select_own
on public.investment_committee_cycles
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists investment_committee_cycles_insert_own on public.investment_committee_cycles;
create policy investment_committee_cycles_insert_own
on public.investment_committee_cycles
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists investment_committee_cycles_update_own on public.investment_committee_cycles;
create policy investment_committee_cycles_update_own
on public.investment_committee_cycles
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists investment_committee_cycles_delete_own on public.investment_committee_cycles;
create policy investment_committee_cycles_delete_own
on public.investment_committee_cycles
for delete
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists investment_committee_deals_select_own on public.investment_committee_deals;
create policy investment_committee_deals_select_own
on public.investment_committee_deals
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists investment_committee_deals_insert_own on public.investment_committee_deals;
create policy investment_committee_deals_insert_own
on public.investment_committee_deals
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists investment_committee_deals_update_own on public.investment_committee_deals;
create policy investment_committee_deals_update_own
on public.investment_committee_deals
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists investment_committee_deals_delete_own on public.investment_committee_deals;
create policy investment_committee_deals_delete_own
on public.investment_committee_deals
for delete
to authenticated
using (user_id = app_private.current_user_id());
