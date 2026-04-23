alter table public.captures
  add column if not exists priority text check (priority in ('low', 'medium', 'high'));
