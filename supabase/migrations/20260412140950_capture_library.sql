alter table public.captures
  add column if not exists type text check (type in ('note', 'task')),
  add column if not exists title text,
  add column if not exists original_content text,
  add column if not exists working_content text,
  add column if not exists last_active_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists save_state text not null default 'saved' check (save_state in ('saved', 'pending', 'error')),
  add column if not exists save_state_detail text;

update public.captures
set
  type = coalesce(type, pattern),
  title = coalesce(title, left(regexp_replace(trim(summary), '\s+', ' ', 'g'), 120)),
  original_content = coalesce(
    original_content,
    trim(
      both E'\n' from concat_ws(
        E'\n\n',
        nullif(trim(summary), ''),
        case
          when follow_up is not null and trim(follow_up) <> '' then 'Follow-up:' || E'\n' || trim(follow_up)
          else null
        end,
        case
          when private_context is not null and trim(private_context) <> '' then 'Private context:' || E'\n' || trim(private_context)
          else null
        end
      )
    )
  ),
  working_content = coalesce(
    working_content,
    trim(
      both E'\n' from concat_ws(
        E'\n\n',
        nullif(trim(summary), ''),
        case
          when follow_up is not null and trim(follow_up) <> '' then 'Follow-up:' || E'\n' || trim(follow_up)
          else null
        end,
        case
          when private_context is not null and trim(private_context) <> '' then 'Private context:' || E'\n' || trim(private_context)
          else null
        end
      )
    )
  ),
  last_active_at = coalesce(last_active_at, updated_at, captured_at, created_at),
  archived_at = case
    when status = 'archived' then coalesce(archived_at, updated_at, captured_at, created_at)
    else archived_at
  end
where type is null
   or title is null
   or original_content is null
   or working_content is null
   or last_active_at is null
   or (status = 'archived' and archived_at is null);

alter table public.captures
  alter column type set not null,
  alter column title set not null,
  alter column original_content set not null,
  alter column working_content set not null,
  alter column last_active_at set not null;

create table if not exists public.capture_updates (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.captures(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('update', 'comment')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_captures_user_type_last_active
  on public.captures(user_id, type, last_active_at desc);

create index if not exists idx_captures_user_archived_last_active
  on public.captures(user_id, archived_at, last_active_at desc);

create index if not exists idx_captures_user_task_due_last_active
  on public.captures(user_id, due_at, last_active_at desc)
  where type = 'task' and deleted_at is null;

create index if not exists idx_capture_updates_capture_created_at
  on public.capture_updates(capture_id, created_at desc);
