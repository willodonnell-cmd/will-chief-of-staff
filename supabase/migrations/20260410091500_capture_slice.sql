create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_path text,
  pattern text not null check (pattern in ('note', 'task')),
  privacy text not null check (privacy in ('open', 'protected', 'hybrid')),
  summary text not null,
  follow_up text,
  private_context text,
  status text not null default 'active' check (status in ('active', 'archived')),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captures_user_captured_at
  on public.captures(user_id, captured_at desc);

create index if not exists idx_captures_user_status_captured_at
  on public.captures(user_id, status, captured_at desc);

drop trigger if exists set_captures_updated_at on public.captures;
create trigger set_captures_updated_at before update on public.captures for each row execute function public.set_updated_at();
