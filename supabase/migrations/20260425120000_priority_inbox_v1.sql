create table if not exists public.priority_inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null check (source in ('outlook', 'gmail', 'teams', 'manual')),
  source_label text not null,
  source_family text not null check (source_family in ('email', 'teams', 'manual')),
  source_link text not null,
  sender text not null,
  sender_role text,
  thread_title text not null,
  primary_line text not null,
  summary text not null,
  time_label text not null,
  visible_state text not null check (visible_state in ('high_priority', 'needs_review', 'deferred', 'handled', 'dismissed')),
  prior_visible_state text check (prior_visible_state in ('high_priority', 'needs_review')),
  deferred_until timestamptz,
  deferred_label text,
  deferred_reason text check (deferred_reason in ('not_now', 'waiting_for_context', 'follow_up_later', 'closer_to_meeting', 'waiting_for_reply')),
  disposition text check (disposition in ('source_opened', 'deferred', 'task_created', 'initiative_created', 'commitment_created', 'reference_saved', 'marked_handled', 'dismissed')),
  disposition_reason text check (disposition_reason in (
    'cold_outreach',
    'low_value',
    'irrelevant',
    'duplicate',
    'generic_update',
    'not_actionable',
    'handled_by_email',
    'handled_by_phone',
    'handled_by_text',
    'handled_in_meeting',
    'delegated_elsewhere',
    'no_further_action_needed',
    'reply_needed',
    'follow_up_needed',
    'decision_needed',
    'relationship_context',
    'business_context',
    'waiting_for_more_context'
  )),
  disposition_label text,
  updated_cue text,
  relationship_cue text,
  sensitive_context text,
  attachment_cue text,
  grouped_cue text,
  why_surfaced text not null,
  supporting_signals jsonb not null default '[]'::jsonb,
  recommended_action text not null check (recommended_action in ('defer', 'create_task', 'add_commitment', 'save_reference', 'mark_handled')),
  task_prefill jsonb,
  commitment_prefill jsonb,
  initiative_prefill jsonb,
  reference_prefill jsonb,
  created_object jsonb,
  sort_order integer not null default 0,
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.priority_inbox_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.priority_inbox_items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('seeded', 'manual_add', 'source_opened', 'transition', 'promoted', 'demoted', 'restored')),
  from_state text check (from_state in ('high_priority', 'needs_review', 'deferred', 'handled', 'dismissed')),
  to_state text check (to_state in ('high_priority', 'needs_review', 'deferred', 'handled', 'dismissed')),
  disposition text check (disposition in ('source_opened', 'deferred', 'task_created', 'initiative_created', 'commitment_created', 'reference_saved', 'marked_handled', 'dismissed')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_priority_inbox_items_user_state_sort
  on public.priority_inbox_items(user_id, visible_state, sort_order, last_changed_at desc);

create index if not exists idx_priority_inbox_items_user_source_family_state
  on public.priority_inbox_items(user_id, source_family, visible_state, last_changed_at desc);

create index if not exists idx_priority_inbox_items_user_deferred_due
  on public.priority_inbox_items(user_id, deferred_until)
  where visible_state = 'deferred';

create index if not exists idx_priority_inbox_events_item_created_at
  on public.priority_inbox_events(item_id, created_at desc);

create index if not exists idx_priority_inbox_events_user_created_at
  on public.priority_inbox_events(user_id, created_at desc);

drop trigger if exists set_priority_inbox_items_updated_at on public.priority_inbox_items;
create trigger set_priority_inbox_items_updated_at
before update on public.priority_inbox_items
for each row
execute function public.set_updated_at();

alter table public.priority_inbox_items enable row level security;
alter table public.priority_inbox_events enable row level security;

drop policy if exists priority_inbox_items_select_own on public.priority_inbox_items;
create policy priority_inbox_items_select_own
on public.priority_inbox_items
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_items_insert_own on public.priority_inbox_items;
create policy priority_inbox_items_insert_own
on public.priority_inbox_items
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_items_update_own on public.priority_inbox_items;
create policy priority_inbox_items_update_own
on public.priority_inbox_items
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_items_delete_own on public.priority_inbox_items;
create policy priority_inbox_items_delete_own
on public.priority_inbox_items
for delete
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_events_select_own on public.priority_inbox_events;
create policy priority_inbox_events_select_own
on public.priority_inbox_events
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_events_insert_own on public.priority_inbox_events;
create policy priority_inbox_events_insert_own
on public.priority_inbox_events
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_events_update_own on public.priority_inbox_events;
create policy priority_inbox_events_update_own
on public.priority_inbox_events
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_events_delete_own on public.priority_inbox_events;
create policy priority_inbox_events_delete_own
on public.priority_inbox_events
for delete
to authenticated
using (user_id = app_private.current_user_id());
