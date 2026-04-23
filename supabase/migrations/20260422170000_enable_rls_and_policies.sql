-- Enable RLS and add ownership policies.
-- Note: service_role bypasses RLS; these policies are for anon/authenticated access.

create schema if not exists app_private;

create or replace function app_private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
$$;

revoke all on function app_private.current_user_id() from public;
grant execute on function app_private.current_user_id() to authenticated;

-- Users
alter table public.users enable row level security;
drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (auth_user_id = auth.uid());

drop policy if exists users_update_own on public.users;
create policy users_update_own
on public.users
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

-- Owner-scoped tables (user_id)
do $$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'user_id'
      and c.relname in (
        'people',
        'commitments',
        'signals',
        'briefings',
        'today_briefs',
        'today_glance_items',
        'today_quiet_items',
        'today_support_notes',
        'admin_setting_groups',
        'admin_recommendations',
        'admin_material_changes',
        'initiatives',
        'initiative_items',
        'captures',
        'capture_updates'
      )
  loop
    execute format('alter table %I.%I enable row level security', t.schema_name, t.table_name);

    execute format('drop policy if exists %I_select_own on %I.%I', t.table_name, t.schema_name, t.table_name);
    execute format(
      'create policy %I_select_own on %I.%I for select to authenticated using (user_id = app_private.current_user_id())',
      t.table_name, t.schema_name, t.table_name
    );

    execute format('drop policy if exists %I_insert_own on %I.%I', t.table_name, t.schema_name, t.table_name);
    execute format(
      'create policy %I_insert_own on %I.%I for insert to authenticated with check (user_id = app_private.current_user_id())',
      t.table_name, t.schema_name, t.table_name
    );

    execute format('drop policy if exists %I_update_own on %I.%I', t.table_name, t.schema_name, t.table_name);
    execute format(
      'create policy %I_update_own on %I.%I for update to authenticated using (user_id = app_private.current_user_id()) with check (user_id = app_private.current_user_id())',
      t.table_name, t.schema_name, t.table_name
    );

    execute format('drop policy if exists %I_delete_own on %I.%I', t.table_name, t.schema_name, t.table_name);
    execute format(
      'create policy %I_delete_own on %I.%I for delete to authenticated using (user_id = app_private.current_user_id())',
      t.table_name, t.schema_name, t.table_name
    );
  end loop;
end $$;

