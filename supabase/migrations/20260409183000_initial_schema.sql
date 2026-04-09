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

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  full_name text not null,
  timezone text not null default 'America/Los_Angeles',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  full_name text not null,
  role_title text,
  organization text,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  importance smallint not null default 2 check (importance between 1 and 3),
  why_now_title text not null,
  why_now_summary text not null,
  quiet_state_note text,
  protected_context text,
  next_interaction_title text,
  next_interaction_note text,
  next_interaction_guidance text,
  next_interaction_at timestamptz,
  cadence_note text,
  horizon_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  title text not null,
  summary text not null,
  owner_type text not null default 'self' check (owner_type in ('self', 'other')),
  owner_label text,
  status text not null default 'open' check (status in ('open', 'quiet', 'at_risk', 'done', 'archived')),
  due_label text,
  due_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  signal_type text not null check (signal_type in ('interaction')),
  title text not null,
  note text not null,
  occurred_label text,
  occurred_at timestamptz,
  status text not null default 'active' check (status in ('active', 'quiet', 'backgrounded', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  kind text not null check (kind in ('detail')),
  title text not null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'backgrounded', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_people_user_sort on public.people(user_id, sort_order);
create index if not exists idx_commitments_person_status on public.commitments(user_id, person_id, status, sort_order);
create index if not exists idx_signals_person_type_occurred on public.signals(user_id, person_id, signal_type, occurred_at desc);
create index if not exists idx_briefings_person_kind on public.briefings(user_id, person_id, kind, sort_order);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists set_people_updated_at on public.people;
create trigger set_people_updated_at before update on public.people for each row execute function public.set_updated_at();
drop trigger if exists set_commitments_updated_at on public.commitments;
create trigger set_commitments_updated_at before update on public.commitments for each row execute function public.set_updated_at();
drop trigger if exists set_signals_updated_at on public.signals;
create trigger set_signals_updated_at before update on public.signals for each row execute function public.set_updated_at();
drop trigger if exists set_briefings_updated_at on public.briefings;
create trigger set_briefings_updated_at before update on public.briefings for each row execute function public.set_updated_at();
