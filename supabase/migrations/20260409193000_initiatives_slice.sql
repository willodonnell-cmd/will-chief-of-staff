create table if not exists public.initiatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'quiet', 'at_risk', 'archived')),
  why_now_title text not null,
  why_now_summary text not null,
  attention_state_note text,
  summary_title text not null,
  summary_body text not null,
  risk_framing text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.initiative_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  section text not null check (
    section in (
      'risk_point',
      'key_change',
      'stakeholder',
      'related_signal',
      'open_loop',
      'timeline_event',
      'linked_artifact',
      'goal_marker'
    )
  ),
  label text,
  title text,
  body text not null,
  status text not null default 'active' check (status in ('active', 'backgrounded', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_initiatives_user_sort on public.initiatives(user_id, sort_order);
create index if not exists idx_initiative_items_section_sort on public.initiative_items(user_id, initiative_id, section, sort_order);

drop trigger if exists set_initiatives_updated_at on public.initiatives;
create trigger set_initiatives_updated_at before update on public.initiatives for each row execute function public.set_updated_at();
drop trigger if exists set_initiative_items_updated_at on public.initiative_items;
create trigger set_initiative_items_updated_at before update on public.initiative_items for each row execute function public.set_updated_at();
