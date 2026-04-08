# Technical Architecture Memo

## Current foundation

- One responsive web app built with Next.js App Router, React, TypeScript, and Tailwind.
- Deployment target is Vercel.
- Supabase is the default backend surface for Postgres, auth, and storage.
- Trigger.dev is reserved for background automation and asynchronous workflows.

## Shell decisions

- The shell follows the product rules: dark, architectural navigation around a light mineral content plane.
- Mobile uses a 5-slot bottom navigation with Capture centered and elevated.
- iPad and Mac expand into a persistent sidebar shell instead of becoming separate native apps.
- Components are token-driven so palette, spacing, elevation, and typography can evolve without rewriting layouts.

## Initial project structure

- `app/` contains App Router routes and the top-level layout.
- `components/` contains reusable shell and content primitives.
- `lib/` contains navigation config, utilities, and backend client helpers.
- `trigger/` is reserved for Trigger.dev jobs and task definitions.

## Next steps

- Add Supabase auth/session wiring and schema-backed data models.
- Introduce Trigger.dev jobs for summarization, inbox processing, and recurring chief-of-staff workflows.
- Replace placeholder route content with real Today, Inbox, People, Initiatives, and Commitments experiences.
