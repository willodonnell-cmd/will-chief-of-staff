create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0,
  is_fallback boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.task_capture_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expand_next_step_by_default boolean not null default false,
  expand_desired_outcome_by_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists set_task_categories_updated_at on public.task_categories;
create trigger set_task_categories_updated_at
before update on public.task_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_task_capture_settings_updated_at on public.task_capture_settings;
create trigger set_task_capture_settings_updated_at
before update on public.task_capture_settings
for each row execute function public.set_updated_at();

insert into public.task_categories (user_id, slug, name, sort_order, is_fallback)
select
  users.id,
  defaults.slug,
  defaults.name,
  defaults.sort_order,
  defaults.is_fallback
from public.users as users
cross join (
  values
    ('priority-action', 'Priority Action', 0, false),
    ('calendar', 'Calendar', 1, false),
    ('person', 'Person', 2, false),
    ('agenda', 'Agenda', 3, false),
    ('waiting-for', 'Waiting For', 4, false),
    ('personal', 'Personal', 5, false),
    ('tbd', 'TBD', 6, true)
) as defaults(slug, name, sort_order, is_fallback)
on conflict (user_id, slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_fallback = excluded.is_fallback;

insert into public.task_capture_settings (user_id)
select id
from public.users
on conflict (user_id) do nothing;

alter table public.captures
  add column if not exists note_title text,
  add column if not exists note_body text,
  add column if not exists task_description text,
  add column if not exists task_next_step text,
  add column if not exists task_desired_outcome text,
  add column if not exists task_category_id uuid references public.task_categories(id) on delete set null,
  add column if not exists linked_initiative_id uuid references public.initiatives(id) on delete set null,
  add column if not exists origin_capture_id uuid references public.captures(id) on delete set null,
  add column if not exists origin_type text check (origin_type in ('note', 'task', 'email', 'capture'));

update public.captures as captures
set
  note_title = case
    when coalesce(captures.type, captures.pattern) = 'note' then nullif(trim(captures.title), '')
    else note_title
  end,
  note_body = case
    when coalesce(captures.type, captures.pattern) = 'note' then
      nullif(
        trim(
          coalesce(
            captures.working_content,
            captures.original_content,
            captures.summary
          )
        ),
        ''
      )
    else note_body
  end,
  task_description = case
    when coalesce(captures.type, captures.pattern) = 'task' then
      nullif(
        trim(
          coalesce(
            nullif(captures.summary, ''),
            nullif(captures.title, ''),
            split_part(coalesce(captures.working_content, captures.original_content, ''), E'\n\n', 1)
          )
        ),
        ''
      )
    else task_description
  end,
  task_next_step = case
    when coalesce(captures.type, captures.pattern) = 'task' then nullif(trim(captures.follow_up), '')
    else task_next_step
  end,
  priority = case
    when coalesce(captures.type, captures.pattern) = 'task' then coalesce(captures.priority, 'medium')
    else captures.priority
  end,
  task_category_id = case
    when coalesce(captures.type, captures.pattern) = 'task' and captures.task_category_id is null then (
      select categories.id
      from public.task_categories as categories
      where categories.user_id = captures.user_id
        and categories.is_fallback = true
      order by categories.sort_order asc, categories.created_at asc
      limit 1
    )
    else captures.task_category_id
  end
where captures.note_title is null
   or captures.note_body is null
   or captures.task_description is null
   or captures.task_next_step is null
   or (coalesce(captures.type, captures.pattern) = 'task' and (captures.priority is null or captures.task_category_id is null));

alter table public.captures
  add constraint captures_note_body_required
  check (
    coalesce(type, pattern) <> 'note'
    or (note_body is not null and btrim(note_body) <> '')
  );

alter table public.captures
  add constraint captures_task_description_required
  check (
    coalesce(type, pattern) <> 'task'
    or (task_description is not null and btrim(task_description) <> '')
  );

alter table public.captures
  add constraint captures_task_priority_required
  check (
    coalesce(type, pattern) <> 'task'
    or priority is not null
  );

alter table public.captures
  add constraint captures_task_category_required
  check (
    coalesce(type, pattern) <> 'task'
    or task_category_id is not null
  );

create index if not exists idx_task_categories_user_status_sort
  on public.task_categories(user_id, status, sort_order);

create unique index if not exists idx_task_categories_user_fallback
  on public.task_categories(user_id, is_fallback)
  where is_fallback = true;

create index if not exists idx_captures_user_priority_category_last_active
  on public.captures(user_id, priority, task_category_id, last_active_at desc)
  where coalesce(type, pattern) = 'task' and deleted_at is null;

create index if not exists idx_captures_user_initiative_last_active
  on public.captures(user_id, linked_initiative_id, last_active_at desc)
  where linked_initiative_id is not null and deleted_at is null;

alter table public.task_categories enable row level security;
alter table public.task_capture_settings enable row level security;

drop policy if exists task_categories_select_own on public.task_categories;
create policy task_categories_select_own
on public.task_categories
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists task_categories_insert_own on public.task_categories;
create policy task_categories_insert_own
on public.task_categories
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists task_categories_update_own on public.task_categories;
create policy task_categories_update_own
on public.task_categories
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists task_categories_delete_own on public.task_categories;
create policy task_categories_delete_own
on public.task_categories
for delete
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists task_capture_settings_select_own on public.task_capture_settings;
create policy task_capture_settings_select_own
on public.task_capture_settings
for select
to authenticated
using (user_id = app_private.current_user_id());

drop policy if exists task_capture_settings_insert_own on public.task_capture_settings;
create policy task_capture_settings_insert_own
on public.task_capture_settings
for insert
to authenticated
with check (user_id = app_private.current_user_id());

drop policy if exists task_capture_settings_update_own on public.task_capture_settings;
create policy task_capture_settings_update_own
on public.task_capture_settings
for update
to authenticated
using (user_id = app_private.current_user_id())
with check (user_id = app_private.current_user_id());

drop policy if exists task_capture_settings_delete_own on public.task_capture_settings;
create policy task_capture_settings_delete_own
on public.task_capture_settings
for delete
to authenticated
using (user_id = app_private.current_user_id());
