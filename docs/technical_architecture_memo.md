# Technical Architecture Memo

## Current foundation

- One responsive web app built with Next.js App Router, React, TypeScript, and Tailwind.
- Deployment target is Vercel.
- Supabase is the default backend surface for Postgres, auth, and storage.
- Trigger.dev is reserved for background automation and asynchronous workflows.
- Capture is now implemented as a route-level flow inside the shared shell.
- Dev and production verification use separate Next output directories so local preview does not get corrupted by build checks.
- Production verification uses its own TypeScript config file and restores dev-facing generated references after each build check so local preview stays stable across implementation steps.

## Shell decisions

- The shell follows the product rules: dark, architectural navigation around a light mineral content plane.
- Mobile uses a 5-slot bottom navigation with Capture centered and elevated.
- iPad and Mac expand into a persistent sidebar shell instead of becoming separate native apps.
- Components are token-driven so palette, spacing, elevation, and typography can evolve without rewriting layouts.
- The first pass stays intentionally structural: shell, navigation, responsive layout, and route scaffolding only.

## Capture decisions

- Capture is always available from the center slot of the iPhone bottom nav and from a persistent shell action on iPad and Mac.
- The Capture action inherits route context by passing the current path into the `/capture` route.
- The Capture surface supports `note` and `task` patterns in one shared flow.
- Privacy supports `open`, `protected`, and `hybrid` modes.
- Hybrid capture keeps the main note attached to working context while sensitive detail stays in a protected field.
- Confirmation is intentionally subtle: one line of feedback with adjacent `Undo` and `Edit` actions.
- Corvette red appears only inside protected and hybrid privacy states.
- The Capture icon is a custom old-school microphone so it stays in the same symbolic family as Corvette rather than reading as a generic utility action.

## Initial project structure

- `app/` contains App Router routes and the top-level layout.
- `components/` contains reusable shell and content primitives.
- `lib/` contains navigation config, utilities, and backend client helpers.
- `trigger/` is reserved for Trigger.dev jobs and task definitions.
- `components/capture/` contains the route-level capture flow.
- `components/icons/` contains custom symbolic UI icons such as the Capture microphone.

## Next steps

- Add real route-level product surfaces after the shell is approved.
- Add Supabase auth/session wiring and schema-backed data models.
- Introduce Trigger.dev jobs for summarization, inbox processing, and recurring chief-of-staff workflows.

## Inbox decisions

- Priority Inbox is ordered as `Needs Attention`, `Possible Misses`, then `Priority Threads`.
- Sections are intentionally tight, with compact rows and low item counts by default.
- Each row exposes one primary action, usually `Open`.
- Cold outreach is excluded from the surfaced set by default.
- No explicit clear/done control appears in list rows; triage continues inside the opened thread.
- Elevated treatment is reserved for the rare inbox item that clearly warrants stronger emphasis.

## People decisions

- People pages are relationship briefs first rather than activity feeds.
- Top-layer order is `current read`, `next interaction` when it is soon or important, `open loops / commitments`, then `recent interactions`.
- Deeper relationship context stays collapsed by default so the page can remain glanceable.
- Explicit `no attention needed` language is allowed when the relationship is in a quiet state.
- Corvette appears only when protected relationship context exists.

## Initiative decisions

- Initiative pages are strategic briefs first rather than project dashboards.
- The top layer is ordered as `why this matters now`, `summary / context`, `current risks / tensions`, then `key changes since last review`.
- Deeper sections stay collapsed by default and expand progressively for stakeholders, signals, open loops, history, linked briefings, and success markers.
- The system is allowed to explicitly say an initiative does not currently need attention.
- Refined B treatment is reserved for the initiative element that truly carries the current strategic gravity.

## Commitment decisions

- Commitments pages are obligation briefs first rather than task lists.
- The page order is `what needs attention now`, `what you owe vs what others owe`, `at-risk commitments`, then `recent changes`.
- Backgrounded commitments mostly stay out of sight, with only a very small quiet section when useful.
- The detail view leads with `what it is + why it matters`, then status/risk, stakeholder context, suggested next step, linked context, and subtle recent history.
- Recent history is present but intentionally non-focal.
