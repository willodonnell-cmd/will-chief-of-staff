# Cursor Rules Starter

## Purpose
These rules govern work on the executive Chief of Staff product.

## Core product principles
- Protect attention, do not maximize surfaced relevance.
- Suppress more and let the user pull depth when needed.
- The system must be allowed to say “No attention needed now.”
- Flow over contrast.
- Hierarchy over color.
- Gravity over urgency.
- Accent must be earned.
- Motion should clarify change, not entertain.

## Design-system rules
- Use the approved palette from the tactical component spec.
- Keep shell dark and architectural.
- Keep content plane light, mineral, and calm.
- Use dry mid-tones as glue.
- Use Corvette red only for protected/private moments.
- Use muted moss/olive only for quiet stable/on-track states.
- Use SF Pro feel or Inter.
- Weights: Regular, Medium, Semibold only.
- Use generous spacing with 8px rhythm.
- Use refined B elevation for high-focus items.
- No left accent rule for focus items.
- No loud alert styling.

## UX rules
- Today must be highly glanceable.
- Priority Inbox is triage-first.
- People pages are relationship briefs first.
- Initiative pages are strategic briefs first.
- Commitments pages are obligation briefs first.
- Capture is always available.
- Corvette appears only when protected content exists.
- Drafting happens after opening, not in list views.
- Backgrounded items should mostly stay out of sight.

## Implementation rules
- Build one responsive web app first.
- Do not split into separate native apps first.
- Use Next.js + React + TypeScript + Tailwind.
- Use Supabase for Postgres/Auth/Storage.
- Use Trigger.dev for background jobs.
- Use Vercel for deployment.
- Keep components modular and token-driven.
- When the UI starts feeling too designed, remove color/shadow/border emphasis before adding anything.