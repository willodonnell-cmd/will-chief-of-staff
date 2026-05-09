alter table public.priority_inbox_events
  drop constraint if exists priority_inbox_events_source_check;

alter table public.priority_inbox_events
  add constraint priority_inbox_events_source_check
    check (source in ('outlook', 'gmail', 'teams', 'manual', 'forwarded_email'));
