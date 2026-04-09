# Supabase Schema v1

This project now has a first-pass People-focused Supabase/Postgres schema under [supabase/migrations/20260409183000_initial_schema.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260409183000_initial_schema.sql) and bootstrap data under [supabase/seed.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/seed.sql).

## Shape

- `users` is the app-level owner table.
  - It works in single-user bootstrap mode now.
  - It includes an optional `auth_user_id` so real Supabase Auth can attach later without changing the rest of the schema.
- `people`, `commitments`, `signals`, and `briefings` are all scoped back to `users`.
- `people`, `commitments`, `signals`, and `briefings` carry the first real People-page slice.
  - `people` stores the top-layer relationship brief fields.
  - `commitments` stores open loops tied to a person.
  - `signals` stores recent interaction entries.
  - `briefings` stores quieter supporting context that should stay behind a fold by default.

## Bootstrap mode

- One default local user is seeded as `local@chief-of-staff.app`.
- The first People surface reads data for that bootstrap user without waiting for auth/session wiring.
- Server-side reads prefer the service-role client when available, with the schema still ready for auth-based ownership later.

## Why this stays practical

- Every table has UUID ids, `created_at`, and `updated_at`.
- Status fields stay simple text + check constraints instead of a large enum graph.
- Foreign keys are used where they are concrete and useful.
- The schema is narrow enough to ship now, but it keeps the right hooks for auth later and more than one user later.

## Commitments slice note

- The Commitments slice does not introduce a second obligation table.
- Instead, [supabase/migrations/20260409195500_commitments_slice.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260409195500_commitments_slice.sql) extends `public.commitments` so it can support both:
  - person-linked open loops for the People page
  - general obligation-brief records for the Commitments page
- The additive fields are:
  - `scope`
  - `page_section`
  - `why_it_matters`
  - `risk_note`
  - `stakeholders_note`
  - `next_step`
  - `linked_context`
  - `recent_history`
  - `protected_context`
  - `action_label`
- `person_id` is now nullable so a commitment can either attach to a specific person or stand on its own as a broader operating commitment.
