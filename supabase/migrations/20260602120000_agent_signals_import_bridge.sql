create table if not exists public.source_items (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'microsoft_365',
  source_type text not null check (source_type in ('outlook', 'teams', 'calendar')),
  external_id text not null,
  external_thread_id text,
  external_conversation_id text,
  received_at timestamptz,
  source_url text,
  title text,
  snippet text,
  participants jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null,
  source_payload_kind text not null default 'agent_signal_stub',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_type, external_id)
);

create table if not exists public.agent_signals (
  id uuid primary key default gen_random_uuid(),
  external_signal_id text not null unique,
  source_item_id uuid references public.source_items(id) on delete set null,
  source text not null check (source in ('outlook', 'teams', 'calendar')),
  signal_type text not null check (signal_type in ('decision', 'follow_up', 'meeting', 'status')),
  priority text not null check (priority in ('high', 'medium', 'low')),
  title text not null,
  summary text not null,
  owner text,
  source_label text,
  occurred_at timestamptz,
  due_at timestamptz,
  source_url text,
  suggested_next_step text,
  desired_outcome text,
  people jsonb not null default '[]'::jsonb,
  protected_context boolean not null default false,
  status text not null default 'new' check (status in ('new', 'reviewed', 'dismissed', 'converted_to_task', 'archived')),
  confidence numeric,
  rationale text,
  produced_at timestamptz,
  tenant_label text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_signals_priority
  on public.agent_signals(priority);

create index if not exists idx_agent_signals_source
  on public.agent_signals(source);

create index if not exists idx_agent_signals_signal_type
  on public.agent_signals(signal_type);

create index if not exists idx_agent_signals_due_at
  on public.agent_signals(due_at);

create index if not exists idx_agent_signals_status
  on public.agent_signals(status);

create index if not exists idx_agent_signals_created_at_desc
  on public.agent_signals(created_at desc);

create index if not exists idx_source_items_source_system_type
  on public.source_items(source_system, source_type);

create index if not exists idx_source_items_received_at_desc
  on public.source_items(received_at desc);

drop trigger if exists set_source_items_updated_at on public.source_items;
create trigger set_source_items_updated_at
before update on public.source_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_agent_signals_updated_at on public.agent_signals;
create trigger set_agent_signals_updated_at
before update on public.agent_signals
for each row
execute function public.set_updated_at();
