create table if not exists public.today_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  high_focus_title text not null,
  high_focus_summary text not null,
  high_focus_owner text not null,
  high_focus_timing text not null,
  high_focus_decision text not null,
  quiet_panel_eyebrow text not null,
  quiet_panel_title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.today_glance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  today_brief_id uuid not null references public.today_briefs(id) on delete cascade,
  label text not null,
  value text not null,
  tone text not null default 'default' check (tone in ('default', 'quiet', 'protected')),
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.today_quiet_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  today_brief_id uuid not null references public.today_briefs(id) on delete cascade,
  label text not null,
  detail text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.today_support_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  today_brief_id uuid not null references public.today_briefs(id) on delete cascade,
  eyebrow text not null,
  title text not null,
  body text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_today_briefs_user_sort on public.today_briefs(user_id, sort_order);
create index if not exists idx_today_glance_items_brief_sort on public.today_glance_items(user_id, today_brief_id, sort_order);
create index if not exists idx_today_quiet_items_brief_sort on public.today_quiet_items(user_id, today_brief_id, sort_order);
create index if not exists idx_today_support_notes_brief_sort on public.today_support_notes(user_id, today_brief_id, sort_order);

drop trigger if exists set_today_briefs_updated_at on public.today_briefs;
create trigger set_today_briefs_updated_at before update on public.today_briefs for each row execute function public.set_updated_at();
drop trigger if exists set_today_glance_items_updated_at on public.today_glance_items;
create trigger set_today_glance_items_updated_at before update on public.today_glance_items for each row execute function public.set_updated_at();
drop trigger if exists set_today_quiet_items_updated_at on public.today_quiet_items;
create trigger set_today_quiet_items_updated_at before update on public.today_quiet_items for each row execute function public.set_updated_at();
drop trigger if exists set_today_support_notes_updated_at on public.today_support_notes;
create trigger set_today_support_notes_updated_at before update on public.today_support_notes for each row execute function public.set_updated_at();
