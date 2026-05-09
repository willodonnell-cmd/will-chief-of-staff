alter table public.priority_inbox_events
  drop constraint if exists priority_inbox_events_action_check;

alter table public.priority_inbox_events
  add constraint priority_inbox_events_action_check
  check (action in ('seeded', 'manual_add', 'inbound_received', 'source_opened', 'transition', 'promoted', 'demoted', 'restored'));
