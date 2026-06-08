alter table public.executive_brief_snapshots
  add column if not exists structured_brief jsonb,
  add column if not exists contract_version text,
  add column if not exists validation_warnings text[] not null default '{}';

create index if not exists idx_executive_brief_snapshots_user_contract_version
  on public.executive_brief_snapshots(user_id, contract_version)
  where contract_version is not null;
