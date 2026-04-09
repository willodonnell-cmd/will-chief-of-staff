create table if not exists public.admin_setting_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  tier text not null check (tier in ('primary', 'secondary')),
  eyebrow text not null,
  title text not null,
  summary text not null,
  current_state text not null,
  note text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.admin_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  summary text not null,
  impacts text not null,
  why text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_material_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  changed_at_label text not null,
  title text not null,
  summary text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_setting_groups_user_tier_sort
  on public.admin_setting_groups(user_id, tier, sort_order);
create index if not exists idx_admin_recommendations_user_sort
  on public.admin_recommendations(user_id, sort_order);
create index if not exists idx_admin_material_changes_user_sort
  on public.admin_material_changes(user_id, sort_order);

drop trigger if exists set_admin_setting_groups_updated_at on public.admin_setting_groups;
create trigger set_admin_setting_groups_updated_at before update on public.admin_setting_groups for each row execute function public.set_updated_at();
drop trigger if exists set_admin_recommendations_updated_at on public.admin_recommendations;
create trigger set_admin_recommendations_updated_at before update on public.admin_recommendations for each row execute function public.set_updated_at();
drop trigger if exists set_admin_material_changes_updated_at on public.admin_material_changes;
create trigger set_admin_material_changes_updated_at before update on public.admin_material_changes for each row execute function public.set_updated_at();
