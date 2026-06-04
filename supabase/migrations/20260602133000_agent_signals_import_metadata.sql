alter table public.agent_signals
add column if not exists imported_at timestamptz;

update public.agent_signals
set imported_at = coalesce(imported_at, produced_at, updated_at)
where imported_at is null;

alter table public.agent_signals
add column if not exists import_source_mode text not null default 'database';

alter table public.agent_signals
drop constraint if exists agent_signals_import_source_mode_check;

alter table public.agent_signals
add constraint agent_signals_import_source_mode_check
check (import_source_mode in ('database', 'fixture_dev'));

update public.agent_signals
set import_source_mode = 'fixture_dev'
where external_signal_id in (
  'outlook-board-packet-scope',
  'teams-ops-checkin',
  'calendar-board-prep'
);

create index if not exists idx_agent_signals_imported_at_desc
  on public.agent_signals(imported_at desc);
