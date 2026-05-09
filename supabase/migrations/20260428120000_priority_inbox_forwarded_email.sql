alter table public.priority_inbox_items
  add column if not exists ingestion_mode text;

update public.priority_inbox_items
set ingestion_mode = case
  when source = 'manual' then 'manual'
  else 'live_adapter'
end
where ingestion_mode is null;

alter table public.priority_inbox_items
  alter column ingestion_mode set default 'live_adapter',
  alter column ingestion_mode set not null,
  alter column source_link drop not null;

alter table public.priority_inbox_items
  drop constraint if exists priority_inbox_items_source_check,
  drop constraint if exists priority_inbox_items_ingestion_mode_check;

alter table public.priority_inbox_items
  add constraint priority_inbox_items_source_check
    check (source in ('outlook', 'gmail', 'teams', 'manual', 'forwarded_email')),
  add constraint priority_inbox_items_ingestion_mode_check
    check (ingestion_mode in ('live_adapter', 'forwarded', 'manual'));

create table if not exists public.priority_inbox_forwarding_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  destination_address text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (destination_address)
);

create table if not exists public.priority_inbox_forwarded_email_sources (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.priority_inbox_items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  destination_address text not null,
  forwarded_by_name text,
  forwarded_by_email text,
  original_sender_name text,
  original_sender_email text,
  original_subject text,
  original_received_at timestamptz,
  forwarded_at timestamptz,
  provider_hint text check (provider_hint in ('outlook', 'gmail')),
  native_source_link text,
  raw_content text not null,
  detail_body text,
  attachment_names text[] not null default '{}'::text[],
  parsed_headers jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id)
);

alter table public.captures
  add column if not exists priority_inbox_source_metadata jsonb;

create index if not exists idx_priority_inbox_forwarding_configs_user
  on public.priority_inbox_forwarding_configs(user_id);

create index if not exists idx_priority_inbox_forwarded_email_sources_user
  on public.priority_inbox_forwarded_email_sources(user_id, created_at desc);

create index if not exists idx_priority_inbox_forwarded_email_sources_destination
  on public.priority_inbox_forwarded_email_sources(destination_address, created_at desc);

drop trigger if exists set_priority_inbox_forwarding_configs_updated_at on public.priority_inbox_forwarding_configs;
create trigger set_priority_inbox_forwarding_configs_updated_at
before update on public.priority_inbox_forwarding_configs
for each row
execute function public.set_updated_at();

drop trigger if exists set_priority_inbox_forwarded_email_sources_updated_at on public.priority_inbox_forwarded_email_sources;
create trigger set_priority_inbox_forwarded_email_sources_updated_at
before update on public.priority_inbox_forwarded_email_sources
for each row
execute function public.set_updated_at();

alter table public.priority_inbox_forwarding_configs enable row level security;
alter table public.priority_inbox_forwarded_email_sources enable row level security;

drop policy if exists priority_inbox_forwarding_configs_select_own on public.priority_inbox_forwarding_configs;
create policy priority_inbox_forwarding_configs_select_own
on public.priority_inbox_forwarding_configs
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarding_configs_insert_own on public.priority_inbox_forwarding_configs;
create policy priority_inbox_forwarding_configs_insert_own
on public.priority_inbox_forwarding_configs
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarding_configs_update_own on public.priority_inbox_forwarding_configs;
create policy priority_inbox_forwarding_configs_update_own
on public.priority_inbox_forwarding_configs
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarding_configs_delete_own on public.priority_inbox_forwarding_configs;
create policy priority_inbox_forwarding_configs_delete_own
on public.priority_inbox_forwarding_configs
for delete
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarded_email_sources_select_own on public.priority_inbox_forwarded_email_sources;
create policy priority_inbox_forwarded_email_sources_select_own
on public.priority_inbox_forwarded_email_sources
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarded_email_sources_insert_own on public.priority_inbox_forwarded_email_sources;
create policy priority_inbox_forwarded_email_sources_insert_own
on public.priority_inbox_forwarded_email_sources
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarded_email_sources_update_own on public.priority_inbox_forwarded_email_sources;
create policy priority_inbox_forwarded_email_sources_update_own
on public.priority_inbox_forwarded_email_sources
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists priority_inbox_forwarded_email_sources_delete_own on public.priority_inbox_forwarded_email_sources;
create policy priority_inbox_forwarded_email_sources_delete_own
on public.priority_inbox_forwarded_email_sources
for delete
to authenticated
using (user_id = app_private.current_user_id());
