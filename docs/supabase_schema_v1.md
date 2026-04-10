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

## Today slice note

- The Today slice adds a small brief-oriented set of tables in [supabase/migrations/20260409203000_today_slice.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260409203000_today_slice.sql).
- `today_briefs` stores the current top-layer operating brief for the bootstrap user:
  - high-focus item title, summary, owner, timing, and next decision
  - quiet-panel eyebrow and title
- `today_glance_items` stores the top metrics/chips in their current display order and tone.
- `today_quiet_items` stores the quiet background rows for the right-side panel.
- `today_support_notes` stores the lower supporting notes for the current day view.
- This keeps the Today screen data-backed without forcing unrelated screens onto a broader dashboard-style schema.

## Admin slice note

- The Admin slice adds a small settings-oriented set of tables in [supabase/migrations/20260409210000_admin_slice.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260409210000_admin_slice.sql).
- `admin_setting_groups` stores the current landing-page settings groups for the bootstrap user, including tier, summary, current state, and note copy.
- `admin_recommendations` stores the visible recommended changes module entries.
- `admin_material_changes` stores the material-only history rows that appear on the landing page.
- This keeps the current Admin surface data-backed without inventing deeper settings routes or a more complex policy graph before auth exists.

## Inbox slice note

- The Inbox slice adds one narrow table in [supabase/migrations/20260409224500_inbox_slice.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260409224500_inbox_slice.sql).
- `inbox_threads` stores the currently surfaced inbox rows for the bootstrap user, including:
  - section placement (`needs_attention`, `possible_misses`, `priority_threads`)
  - sender, subject, preview, and received label
  - row flags for elevated and protected treatment
  - the row action label
- This keeps the current triage-first Inbox surface data-backed without introducing a full mail model, message body system, or thread-detail schema yet.

## Wiring status

- Fully data-backed today:
  - [app/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/page.tsx)
  - [app/inbox/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/inbox/page.tsx)
  - [app/people/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/people/page.tsx)
  - [app/initiatives/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/initiatives/page.tsx)
  - [app/commitments/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/commitments/page.tsx)
  - [app/admin/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/admin/page.tsx)
- These screens read seeded Supabase data through their server-side data access layers and the shared auth-or-bootstrap user resolver.
- Remaining static copy inside those files is fallback-only null-state text, not the primary data source when Supabase is configured and seeded.
- Missing migrations or seed data for those wired screens: none. The current migration set and [supabase/seed.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/seed.sql) cover their live data dependencies.
- Still needing backend wiring:
  - [app/capture/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/capture/page.tsx) and the route-level capture persistence flow behind it
