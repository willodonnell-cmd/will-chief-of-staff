alter table public.commitments
  alter column person_id drop not null;

alter table public.commitments
  add column if not exists scope text not null default 'person' check (scope in ('person', 'general')),
  add column if not exists page_section text check (
    page_section in (
      'detail',
      'needs_attention',
      'owed',
      'at_risk',
      'recent_changes',
      'background'
    )
  ),
  add column if not exists why_it_matters text,
  add column if not exists risk_note text,
  add column if not exists stakeholders_note text,
  add column if not exists next_step text,
  add column if not exists linked_context text,
  add column if not exists recent_history text,
  add column if not exists protected_context boolean not null default false,
  add column if not exists action_label text;

create index if not exists idx_commitments_user_scope_section_sort
  on public.commitments(user_id, scope, page_section, sort_order);
