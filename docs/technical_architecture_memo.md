# Technical Architecture Memo

## Current foundation

- One responsive web app built with Next.js App Router, React, TypeScript, and Tailwind.
- Deployment target is Vercel.
- Supabase is the default backend surface for Postgres, auth, and storage.
- Trigger.dev is reserved for background automation and asynchronous workflows.
- Capture is now implemented as a route-level flow inside the shared shell.

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
