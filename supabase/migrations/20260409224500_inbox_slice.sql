create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  section text not null check (section in ('needs_attention', 'possible_misses', 'priority_threads')),
  sender text not null,
  subject text not null,
  preview text not null,
  received_label text not null,
  action_label text not null default 'Open',
  elevated boolean not null default false,
  protected_thread boolean not null default false,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inbox_threads_user_section_sort
  on public.inbox_threads(user_id, section, sort_order);

drop trigger if exists set_inbox_threads_updated_at on public.inbox_threads;
create trigger set_inbox_threads_updated_at before update on public.inbox_threads for each row execute function public.set_updated_at();
