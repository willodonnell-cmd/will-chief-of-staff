# will-chief-of-staff

Will O'Donnell's Agentic Chief of Staff.

**Agent & docs:** see [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/).

## Supabase auth + bootstrap mode

- The app now includes Supabase auth/session plumbing through:
  - [middleware.ts](/Users/willodonnell/Documents/will-chief-of-staff/middleware.ts) for session refresh
  - [app/auth/callback/route.ts](/Users/willodonnell/Documents/will-chief-of-staff/app/auth/callback/route.ts) for exchanging auth codes into sessions
  - [lib/supabase/current-user.ts](/Users/willodonnell/Documents/will-chief-of-staff/lib/supabase/current-user.ts) for resolving the current app user
- Current user resolution works in this order:
  - authenticated Supabase session matched by `users.auth_user_id`
  - authenticated Supabase session matched by `users.email`
  - bootstrap fallback user when local/dev fallback is enabled
- The default bootstrap user is defined in [lib/supabase/current-user.ts](/Users/willodonnell/Documents/will-chief-of-staff/lib/supabase/current-user.ts) as `BOOTSTRAP_USER_EMAIL` and seeded in [supabase/seed.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/seed.sql).
- Bootstrap fallback stays on by default in local/dev. It is disabled in production unless `ENABLE_SUPABASE_BOOTSTRAP_FALLBACK=true` is set.
- To remove bootstrap mode later:
  - stop using the bootstrap branch in `resolveCurrentAppUser`
  - require an auth-mapped `users` row
  - remove the bootstrap seed user if it is no longer needed

## Local dev reset

- If local development starts showing stale Next/Webpack behavior after a branch switch, generated-code update, or structural file change, run `npm run reset:dev`.
- `npm run clean` clears `.next` and the local Webpack cache without starting the app.
- `npm run reset:dev` runs that clean step and then starts a fresh dev server.
- If you normally run the app on a custom port, you can still pass flags through, for example: `npm run reset:dev -- --hostname 0.0.0.0 --port 3001`.
- A full reinstall is only necessary when dependency state itself is broken, for example after lockfile changes, failed installs, native module issues, or missing packages. In those cases, remove `node_modules` and reinstall dependencies before starting dev again.
