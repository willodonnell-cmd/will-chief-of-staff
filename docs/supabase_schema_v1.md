# Supabase Schema v1

This project now has a first-pass People-focused Supabase/Postgres schema under [supabase/migrations/20260409183000_initial_schema.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260409183000_initial_schema.sql) and bootstrap data under [supabase/seed.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/seed.sql).

## Shape

- `users` is the app-level owner table.
  - It works in single-user bootstrap mode now.
  - It includes an optional `auth_user_id` so real Supabase Auth can attach later without changing the rest of the schema.
- `people`, `commitments`, `signals`, and `briefings` are all scoped back to `users`.
- `people`, `commitments`, `signals`, and `briefings` carry the first real People-page slice.
  - `people` stores the top-layer relationship brief fields.
  - `commitments` stores person-linked open loops used by the People page.
  - `signals` stores recent interaction entries.
  - `briefings` stores quieter supporting context that should stay behind a fold by default.

## Bootstrap mode

- One default local user is seeded as `local@chief-of-staff.app`.
- The first People surface reads data for that bootstrap user without waiting for auth/session wiring.
- Server-side reads prefer the service-role client when available, with the schema still ready for auth-based ownership later.
- In local/dev, the app can also fall back to the known bootstrap user record directly when the bootstrap lookup itself is unavailable, so write paths like Capture can still target the seeded user row deterministically.

## Why this stays practical

- Every table has UUID ids, `created_at`, and `updated_at`.
- Status fields stay simple text + check constraints instead of a large enum graph.
- Foreign keys are used where they are concrete and useful.
- The schema is narrow enough to ship now, but it keeps the right hooks for auth later and more than one user later.

## Commitments slice note

- `public.commitments` remains the person-linked open-loops table used by the People page.
- The top-level `/commitments` route no longer reads from `public.commitments`.
- Instead, Commitments is now a surface over canonical task rows in `public.captures`, grouped operationally without copying those task objects into a second store.

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

## Capture slice note

- The Capture slice adds one narrow persistence table in [supabase/migrations/20260410091500_capture_slice.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260410091500_capture_slice.sql).
- `captures` stores route-level Capture submissions for the resolved app user:
  - `source_path` for inherited route context
  - `pattern` for `note` vs `task`
  - `privacy` for `open`, `protected`, and `hybrid`
  - `summary`, optional `follow_up`, and optional `private_context`
- In bootstrap mode, Capture writes against the same seeded default user that powers the other data-backed screens when no auth session exists yet.
- No initial capture rows are seeded; persistence starts empty and fills with real submissions.

## Capture Library note

- The Capture Library extends the same canonical `public.captures` table in [supabase/migrations/20260412140950_capture_library.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260412140950_capture_library.sql) instead of introducing a parallel saved-items system.
- `captures` now also carries the library-facing fields needed for retrieval and lifecycle state:
  - `type`
  - `title`
  - `original_content`
  - `working_content`
  - `last_active_at`
  - `archived_at`
  - `completed_at`
  - `deleted_at`
  - `due_at`
  - `save_state`
  - `save_state_detail`
- Task System v1 continues to live on the same canonical `captures` row rather than a copied task table:
  - `title` is the required task title
  - `status` is the required task field surfaced in the app and derived from `completed_at` (`active` or `completed`)
  - `due_at` is the optional task due timestamp
  - `priority` is the optional task priority (`low`, `medium`, `high`) added in [supabase/migrations/20260422183000_task_system_v1.sql](/Users/willodonnell/Documents/will-chief-of-staff/supabase/migrations/20260422183000_task_system_v1.sql)
- The Commitments route is a read/group/navigate surface over those same canonical task rows:
  - overdue, due soon, active with no due date, later-dated, and recently completed groupings are all derived at read time
  - navigation from Commitments returns to the existing [app/library/[id]/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/library/[id]/page.tsx) detail surface
  - no commitments-specific task table or duplicate model is introduced
- The original captured content is preserved and immutable in `original_content`.
- Working edits land in `working_content`, while the list views sort by `last_active_at desc` unless the Tasks route applies its operational ranking.
- Append-only updates and comments live in `capture_updates`, keyed back to `captures`, so detail history can grow without mutating the original record.
- Deleted captures are soft-deleted via `deleted_at` and excluded from normal retrieval.

## Wiring status

- Fully data-backed today:
  - [app/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/page.tsx)
  - [app/capture/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/capture/page.tsx)
  - [app/people/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/people/page.tsx)
  - [app/initiatives/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/initiatives/page.tsx)
  - [app/commitments/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/commitments/page.tsx)
  - [app/admin/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/admin/page.tsx)
- These screens read seeded Supabase data through their server-side data access layers and the shared auth-or-bootstrap user resolver.
- Remaining static copy inside those files is fallback-only null-state text, not the primary data source when Supabase is configured and seeded.
- Still needing backend wiring:
  - [app/inbox/page.tsx](/Users/willodonnell/Documents/will-chief-of-staff/app/inbox/page.tsx)
