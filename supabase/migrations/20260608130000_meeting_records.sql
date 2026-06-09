create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.meeting_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  calendar_event_id text not null,
  calendar_source_system_id text not null default 'outlook',
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'America/Los_Angeles',
  organizer_name text,
  organizer_email text,
  attendees jsonb not null default '[]'::jsonb,
  internal_external_classification text not null default 'unknown'
    check (internal_external_classification in ('internal', 'external', 'mixed', 'unknown')),
  related_company_names text[] not null default '{}'::text[],
  related_people_names text[] not null default '{}'::text[],
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  priority_reasons text[] not null default '{}'::text[],
  research_status text not null default 'not_researched'
    check (research_status in ('not_researched', 'researching', 'researched', 'failed')),
  research_requested_at timestamptz,
  research_completed_at timestamptz,
  research_summary jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  transcript_status text not null default 'none'
    check (transcript_status in ('none', 'pending', 'attached', 'processing', 'summarized', 'failed')),
  transcript_refs jsonb not null default '[]'::jsonb,
  post_meeting_status text not null default 'not_started'
    check (post_meeting_status in ('not_started', 'pending', 'summarized', 'failed')),
  post_meeting_summary jsonb,
  task_candidates jsonb not null default '[]'::jsonb,
  linked_task_ids uuid[] not null default '{}'::uuid[],
  obsidian_export_status text not null default 'not_exported'
    check (obsidian_export_status in ('not_exported', 'sending', 'sent_to_taskrobin', 'failed')),
  obsidian_exported_at timestamptz,
  obsidian_email_to text not null default 'wodonnell@taskrobin.io',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, calendar_source_system_id, calendar_event_id)
);

create index if not exists idx_meeting_records_user_start
  on public.meeting_records(user_id, start_at desc nulls last, created_at desc);

create index if not exists idx_meeting_records_user_research_status
  on public.meeting_records(user_id, research_status, start_at desc nulls last);

create index if not exists idx_meeting_records_user_transcript_status
  on public.meeting_records(user_id, transcript_status, start_at desc nulls last);

drop trigger if exists set_meeting_records_updated_at on public.meeting_records;
create trigger set_meeting_records_updated_at
before update on public.meeting_records
for each row
execute function public.set_updated_at();

alter table public.meeting_records enable row level security;

drop policy if exists meeting_records_select_own on public.meeting_records;
create policy meeting_records_select_own
on public.meeting_records
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists meeting_records_insert_own on public.meeting_records;
create policy meeting_records_insert_own
on public.meeting_records
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists meeting_records_update_own on public.meeting_records;
create policy meeting_records_update_own
on public.meeting_records
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists meeting_records_delete_own on public.meeting_records;
create policy meeting_records_delete_own
on public.meeting_records
for delete
to authenticated
using (user_id = app_private.current_user_id());
