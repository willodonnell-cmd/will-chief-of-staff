create table if not exists public.executive_brief_item_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  snapshot_id uuid not null references public.executive_brief_snapshots(id) on delete cascade,
  item_kind text not null check (item_kind in ('task_candidate')),
  item_id text not null,
  item_title text not null,
  feedback_type text not null check (feedback_type in ('dismissed')),
  reason text check (reason in ('not_important', 'already_handled', 'not_my_task', 'bad_recommendation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_id, item_kind, item_id, feedback_type)
);

create index if not exists idx_executive_brief_item_feedback_user_snapshot
  on public.executive_brief_item_feedback(user_id, snapshot_id, item_kind, feedback_type);

drop trigger if exists set_executive_brief_item_feedback_updated_at on public.executive_brief_item_feedback;
create trigger set_executive_brief_item_feedback_updated_at
before update on public.executive_brief_item_feedback
for each row
execute function public.set_updated_at();

alter table public.executive_brief_item_feedback enable row level security;

drop policy if exists executive_brief_item_feedback_select_own on public.executive_brief_item_feedback;
create policy executive_brief_item_feedback_select_own
on public.executive_brief_item_feedback
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists executive_brief_item_feedback_insert_own on public.executive_brief_item_feedback;
create policy executive_brief_item_feedback_insert_own
on public.executive_brief_item_feedback
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists executive_brief_item_feedback_update_own on public.executive_brief_item_feedback;
create policy executive_brief_item_feedback_update_own
on public.executive_brief_item_feedback
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists executive_brief_item_feedback_delete_own on public.executive_brief_item_feedback;
create policy executive_brief_item_feedback_delete_own
on public.executive_brief_item_feedback
for delete
to authenticated
using (user_id = app_private.current_user_id());
