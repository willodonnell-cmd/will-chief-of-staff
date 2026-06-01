alter table public.captures
  add column if not exists executive_work_type text
    check (
      executive_work_type in (
        'strategic_initiative',
        'opportunity',
        'decision',
        'meeting',
        'relationship',
        'delegation',
        'logistics',
        'reference',
        'noise'
      )
    ),
  add column if not exists capture_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_captures_user_executive_work_last_active
  on public.captures(user_id, executive_work_type, last_active_at desc)
  where executive_work_type is not null and deleted_at is null;
