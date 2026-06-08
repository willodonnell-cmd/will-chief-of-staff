create table if not exists public.executive_brief_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject text not null,
  slot text not null,
  generated_at timestamptz,
  display_date text,
  raw_email_body text not null,
  human_brief text,
  json_bundle jsonb,
  source_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint executive_brief_snapshots_slot_check
    check (slot in ('7 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM', 'Manual'))
);

create index if not exists idx_executive_brief_snapshots_user_slot_generated
  on public.executive_brief_snapshots(user_id, slot, generated_at desc nulls last, created_at desc);

create index if not exists idx_executive_brief_snapshots_user_created
  on public.executive_brief_snapshots(user_id, created_at desc);

create unique index if not exists idx_executive_brief_snapshots_user_source_message
  on public.executive_brief_snapshots(user_id, source_message_id);

drop trigger if exists set_executive_brief_snapshots_updated_at on public.executive_brief_snapshots;
create trigger set_executive_brief_snapshots_updated_at
before update on public.executive_brief_snapshots
for each row
execute function public.set_updated_at();

alter table public.executive_brief_snapshots enable row level security;

drop policy if exists executive_brief_snapshots_select_own on public.executive_brief_snapshots;
create policy executive_brief_snapshots_select_own
on public.executive_brief_snapshots
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists executive_brief_snapshots_insert_own on public.executive_brief_snapshots;
create policy executive_brief_snapshots_insert_own
on public.executive_brief_snapshots
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists executive_brief_snapshots_update_own on public.executive_brief_snapshots;
create policy executive_brief_snapshots_update_own
on public.executive_brief_snapshots
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists executive_brief_snapshots_delete_own on public.executive_brief_snapshots;
create policy executive_brief_snapshots_delete_own
on public.executive_brief_snapshots
for delete
to authenticated
using (user_id = app_private.current_user_id());
