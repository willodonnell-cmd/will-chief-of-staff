# Executive Item Nomination Doctrine

Blackhawk is not an executive dashboard. It is an Executive Operating System.

Its purpose is to improve executive judgment and executive leverage by deciding what deserves Will's attention now, why it matters, what action is required, and what evidence supports it.

The homepage should not show workstreams, initiatives, topics, meetings, emails, or tasks just because they exist. It should show Executive Items.

## Executive Item Definition

An Executive Item is a time-bound claim on Will's attention because something meaningful requires awareness, judgment, decision, preparation, escalation, or follow-through now.

Every Executive Item must answer:

- Why is this here?
- Why now?
- What changed?
- What does Will need to do?
- What happens if ignored?
- What evidence supports it?
- Which workstream, initiative, episode, workflow, person, meeting, email, or task generated it?

## Nomination Triggers

An item can be nominated when:

- Will action is required.
- Someone is waiting on Will.
- A deadline is approaching.
- Meeting prep is required.
- Material new information arrived.
- Momentum changed.
- Risk increased.
- Ambiguity increased.
- A key relationship requires attention.
- Executive capacity is at risk.
- Will manually pinned or nominated it.

## Suppression Rules

Suppress items when:

- The item is merely important but not active.
- The issue belongs in a standing workflow and is proceeding normally.
- There is no Will-specific role.
- There is no clear next action.
- The evidence is weak.
- The item is informational only.
- The item is already resolved.
- The item was explicitly deprioritized.
- The item belongs to Investment Committee and follows normal cadence with no exception.

## Strongest Rule

A workstream does not nominate itself.

Ventures, Essentials, PAC, FIQ, Operational Excellence, and Investment Committee should not appear merely because they are important. They appear only when there is a current attention trigger.

## Candidate Registry

Workflow modules nominate Executive Item candidates; they do not control Today or the homepage directly.

The Executive Item Candidate Registry is the shared inspection and eligibility layer between workflow modules and any surface that may later render Executive Items. It receives candidates from source workflows, preserves source metadata and evidence, applies suppression and eligibility checks, and exposes deterministic sorting and summary output.

Today and Executive Brief should consume registry output only after candidates have attention reasons, no active suppression reasons, and a clear recommended next action. Normal standing workflow activity remains inside the source module unless the registry entry represents a real current attention claim.

## Today Surface Integration

Today consumes eligible candidates from the Executive Item Candidate Registry. It does not decide workflow-specific nomination logic, and it does not surface normal standing workflow activity merely because a workflow exists.

The initial Today integration renders eligible candidates with lightweight candidate actions only. Task creation, mark done, pinning, and source-workflow mutations remain future packages.

## Candidate Actions v1

Candidate actions are feedback on attention, not mutations of the source workflow.

- Dismiss suppresses the current candidate.
- Snooze suppresses the current candidate until a future time.
- Mark Reviewed records that Will has seen the current candidate.
- Task creation, pinning, and priority-learning are future packages.

## Admin Audit View

The Admin Audit View is for transparency and debugging. It shows candidate eligibility, interaction state, and source metadata so operators can understand why a candidate is appearing or disappearing from Today.

The audit view is read-only. It does not mutate candidates, candidate interactions, or source workflows. Editing or clearing interactions is a future package if needed.

## Meetings as Candidate Source

Meetings nominate Executive Item candidates only when they create a current attention claim. Normal calendar presence is insufficient.

Meeting-specific nomination logic belongs in the meeting candidate builder. Today consumes eligible meeting candidates through the shared registry and selector, alongside candidates from other source workflows.
