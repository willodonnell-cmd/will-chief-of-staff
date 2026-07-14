create table if not exists public.blackhawk_live_brief_refreshes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null check (trigger in ('open', 'scheduled', 'manual')),
  status text not null default 'requested' check (status in ('requested', 'running', 'succeeded', 'partial', 'failed')),
  idempotency_key text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  source_coverage jsonb not null default '{}'::jsonb,
  validation_errors text[] not null default '{}',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.blackhawk_live_brief_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brief_id text not null,
  contract_version text not null,
  brief jsonb not null,
  generated_at timestamptz not null,
  promoted_from_refresh_id uuid not null references public.blackhawk_live_brief_refreshes(id),
  revision bigint not null default 1 check (revision > 0),
  promoted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blackhawk_live_brief_refreshes_user_started_idx
  on public.blackhawk_live_brief_refreshes (user_id, started_at desc);

alter table public.blackhawk_live_brief_refreshes enable row level security;
alter table public.blackhawk_live_brief_state enable row level security;

drop policy if exists "Users read their Blackhawk refreshes" on public.blackhawk_live_brief_refreshes;
create policy "Users read their Blackhawk refreshes"
  on public.blackhawk_live_brief_refreshes for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users create their Blackhawk refreshes" on public.blackhawk_live_brief_refreshes;
create policy "Users create their Blackhawk refreshes"
  on public.blackhawk_live_brief_refreshes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their Blackhawk refreshes" on public.blackhawk_live_brief_refreshes;
create policy "Users update their Blackhawk refreshes"
  on public.blackhawk_live_brief_refreshes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read their current Blackhawk brief" on public.blackhawk_live_brief_state;
create policy "Users read their current Blackhawk brief"
  on public.blackhawk_live_brief_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.blackhawk_live_brief_state from anon, authenticated;

create or replace function public.promote_blackhawk_live_brief(
  p_refresh_id uuid,
  p_brief jsonb
)
returns public.blackhawk_live_brief_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refresh public.blackhawk_live_brief_refreshes%rowtype;
  v_state public.blackhawk_live_brief_state%rowtype;
  v_generated_at timestamptz;
begin
  select * into v_refresh
  from public.blackhawk_live_brief_refreshes
  where id = p_refresh_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Blackhawk refresh not found or unauthorized.';
  end if;

  if v_refresh.status not in ('running', 'partial') then
    raise exception 'Blackhawk refresh % cannot be promoted from status %.', p_refresh_id, v_refresh.status;
  end if;

  if p_brief ->> 'contractVersion' <> 'blackhawk.live-brief.v1' then
    raise exception 'Unsupported Blackhawk live brief contract.';
  end if;

  if coalesce(p_brief ->> 'briefId', '') = '' then
    raise exception 'Blackhawk live brief requires briefId.';
  end if;

  if jsonb_typeof(p_brief #> '{sections,topActions,items}') <> 'array'
     or jsonb_array_length(p_brief #> '{sections,topActions,items}') > 5 then
    raise exception 'Blackhawk live brief requires zero to five top actions.';
  end if;

  if not (p_brief -> 'sourceCoverage' ?& array['outlook', 'calendar', 'teams']) then
    raise exception 'Blackhawk live brief requires Outlook, Calendar, and Teams coverage.';
  end if;

  begin
    v_generated_at := (p_brief ->> 'generatedAt')::timestamptz;
  exception when others then
    raise exception 'Blackhawk live brief generatedAt is invalid.';
  end;

  insert into public.blackhawk_live_brief_state (
    user_id,
    brief_id,
    contract_version,
    brief,
    generated_at,
    promoted_from_refresh_id,
    revision,
    promoted_at,
    updated_at
  ) values (
    v_refresh.user_id,
    p_brief ->> 'briefId',
    p_brief ->> 'contractVersion',
    p_brief,
    v_generated_at,
    p_refresh_id,
    1,
    now(),
    now()
  )
  on conflict (user_id) do update set
    brief_id = excluded.brief_id,
    contract_version = excluded.contract_version,
    brief = excluded.brief,
    generated_at = excluded.generated_at,
    promoted_from_refresh_id = excluded.promoted_from_refresh_id,
    revision = public.blackhawk_live_brief_state.revision + 1,
    promoted_at = now(),
    updated_at = now()
  returning * into v_state;

  update public.blackhawk_live_brief_refreshes
  set status = case when status = 'partial' then 'partial' else 'succeeded' end,
      completed_at = now(),
      updated_at = now()
  where id = p_refresh_id;

  return v_state;
end;
$$;

revoke all on function public.promote_blackhawk_live_brief(uuid, jsonb) from public, anon;
grant execute on function public.promote_blackhawk_live_brief(uuid, jsonb) to authenticated;
