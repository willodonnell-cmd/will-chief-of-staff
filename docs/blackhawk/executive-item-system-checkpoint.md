# Executive Item System Checkpoint

## Purpose

The Executive Item system exists to surface only time-bound claims on Will's attention. It is not a feed of raw emails, meetings, workflows, topics, tasks, or generic dashboard content.

An Executive Item should appear only when something meaningful requires Will's awareness, judgment, decision, preparation, escalation, or follow-through now.

## Current Architecture

Current flow:

Investment Committee + Meetings
-> source-specific candidate builders
-> Executive Item Candidate Registry
-> Today selector
-> Today Executive Items lane
-> Candidate actions
-> Admin audit view

Source workflows nominate candidates. The shared registry preserves source metadata and evidence, applies eligibility and suppression checks, and gives Today a common candidate shape. Today consumes eligible candidates through the selector and renders them in the Executive Items lane. Candidate actions are recorded through the interaction layer, and the admin audit view explains what the registry and interaction layer are doing.

## Implemented Sources

### Investment Committee

Investment Committee is implemented as a recurring memo-review and question-generation workflow. It can nominate Executive Item candidates when the IC process creates a current attention trigger, such as a package arriving, questions coming due, an exceptional deal, a material issue in peer questions, a missing package, or an unresolved flagged deal around the Monday vote.

IC does not surface normal workflow activity. Routine IC cadence, normal approval noise, and standing process state stay inside the Investment Committee module unless they create a real current claim on Will's attention.

### Meetings

Meetings are implemented as executive events for prep, follow-through, and memory. Meeting candidates are nominated from meeting-specific logic when a meeting record creates a current attention trigger.

Meetings do not surface merely because they exist on the calendar. Calendar presence is insufficient by itself; there must be a prep, follow-through, memory, or other executive-attention reason.

Both implemented sources nominate candidates only when attention triggers exist.

## Implemented Actions

Candidate actions v1:

- Dismiss
- Snooze
- Mark Reviewed

These are attention-feedback actions. They do not mutate IC deals, meeting records, source workflows, tasks, Microsoft data, CloudMailIn data, or Executive Brief snapshots.

The actions suppress or annotate candidate display through the interaction layer. Dismiss suppresses the current candidate, Snooze suppresses it until a future time, and Mark Reviewed records that Will has seen it.

## Persistence

Persistence is implemented in Supabase table `executive_item_candidate_interactions`.

Purpose:

- Record user-scoped Executive Item candidate interactions.
- Store action state for specific candidate interaction keys.
- Let Today and admin views apply dismissal, snooze, and reviewed state without changing source systems.

Scope:

- Interactions are keyed to specific generated candidate interaction keys.
- A user can have one recorded interaction per interaction key.
- Rows include source metadata so interaction state can be audited by source.

RLS is enabled. Select, insert, update, and delete policies are scoped to the current app user through `app_private.current_user_id()`.

## Admin Audit View

Route: `/admin/executive-item-candidates`

The admin audit view shows:

- Candidate registry entries.
- Source metadata.
- Today eligibility.
- Interaction state.
- Suppression state.
- Interaction keys.
- Counts by source, status, and action.

The view is read-only. It exists for transparency, debugging, and operational inspection. It is not a workflow surface and should not become one without a separate product decision.

## Current Non-Goals

- No Executive Brief ingestion changes.
- No Outlook, Teams, Calendar, or Microsoft Graph changes.
- No CloudMailIn changes.
- No task creation from Executive Items yet.
- No pinning.
- No priority-learning or personalization.
- No candidate bulk actions.
- No source workflow mutation from Today.
- No Today replacement or dashboard build.
- No applying old stashes.

## Deferred / Future Packages

Recommended order:

A. Candidate Source #3, likely Executive Brief or Topics, only if needed.

B. Task creation from Executive Item candidates, only after dedupe design is reconciled with the stashed brief-task-dedupe work.

C. Candidate pinning, if product need is clear.

D. Candidate learning / prioritization feedback, after enough interaction data exists.

E. Admin clear/unsnooze tools, only if operationally necessary.

F. Broader Executive Brief / Today refactor, only after reviewing stash contents deliberately.

## Stash Warning

There are known WIP stashes outside the current committed path:

- WIP brief task dedupe before candidate lane.
- WIP executive brief and today refactor before candidate lane.

Do not apply these automatically. They must be reviewed intentionally before use. They are not part of the current Executive Item system checkpoint.

## Operating Rule

New sources may nominate Executive Item candidates, but Today should consume only eligible candidates through the shared registry/selector. Today should not implement source-specific workflow logic.
