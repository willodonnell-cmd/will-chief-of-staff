alter table public.priority_inbox_events
  add column if not exists disposition_reason text check (disposition_reason in (
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
  add column if not exists source text check (source in ('outlook', 'gmail', 'teams', 'manual')),
  add column if not exists created_object jsonb;

alter table public.captures
  add column if not exists priority_inbox_item_id uuid references public.priority_inbox_items(id) on delete set null,
  add column if not exists native_source_link text;

create index if not exists idx_captures_priority_inbox_item
  on public.captures(priority_inbox_item_id)
  where priority_inbox_item_id is not null;
