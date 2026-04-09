# will-chief-of-staff

Will O'Donnell's Agentic Chief of Staff.

**Agent & docs:** see [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/).

## Supabase bootstrap mode

- The first real data-backed slice uses simple single-user bootstrap mode.
- The default local user is defined in [lib/people.ts](/Users/willodonnell/Documents/will-chief-of-staff/lib/people.ts) as `BOOTSTRAP_USER_EMAIL` and seeded in [supabase/seed.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/seed.sql).
- The schema stays compatible with real auth later through `users.auth_user_id`, so Supabase Auth can be layered in without redoing the People tables or relationships.
