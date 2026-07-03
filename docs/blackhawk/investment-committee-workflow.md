# Investment Committee Workflow

Investment Committee is not a deal approval tracker. It is a recurring weekly memo-review and question-generation workflow.

## Canonical Weekly Flow

- Each group sends IC memos into IC.
- On Wednesday, Susan Pi sends a summary email with how many deals are in the package and a link to the Box folder.
- Other IC members send questions back to the team.
- Will also sends questions.
- Will likes reviewing other IC members' questions while writing his own.
- The IC memos are PDFs. Will reads them on his device. Blackhawk should not become a PDF reader.
- Will writes questions into an email and sends it.
- On Monday, IC meets and votes.
- Susan tracks votes and approves the deals.
- Will does not need to see approval emails unless there is an exception.

## Module Purpose

The `/investment-committee` page should help Will:

- Confirm Susan's weekly package arrived.
- Open the Box folder.
- Know how many deals are in the package.
- Review peer questions organized by deal.
- Identify IC X, Energy IC, and exceptional deals.
- Draft or store Will's questions.
- Track whether Will's questions have been sent.
- Suppress normal approval noise after the Monday vote.

## Page Structure

The Investment Committee route remains a top-level app route at `/investment-committee`.

The page should be organized around:

- This Week's Package: week of, Susan package received state, deal count, Box folder, questions due, Monday meeting date.
- Will's Workflow: package received, read PDFs, review peer questions, draft Will questions, send Will questions, Monday vote.
- Deals Requiring Attention: IC X, Energy IC, Will mention, unusual risk, material peer-question activity, deferred or conditional status, not approved, or other exception.
- All Deals: deal title, memo link when available, peer questions, team responses, Will notes or draft questions, Will question status.
- Suppressed / Closed: normal approval emails hidden by default, with approval items available only in archive/search or a collapsed suppressed section.

## Homepage Nomination

Investment Committee should nominate a homepage Executive Item only when:

- Susan package arrived and Friday questions are due soon.
- Questions are due today and Will questions are not marked sent.
- IC X deal detected.
- Energy IC deal detected.
- Will was directly mentioned or asked for input.
- Peer questions reveal a material issue.
- Deal is deferred, conditional, not approved, or unusual.
- Box/package is missing after expected Wednesday timing.
- Monday vote is today and a flagged deal has unresolved notes.

Normal IC process should stay inside the IC module.

## Approval Suppression

Normal Susan approval emails should be suppressed by default.

Surface approval-related items only if:

- Deal not approved.
- Deal deferred.
- Conditional approval.
- Will specifically mentioned.
- Follow-up requested from Will.
- IC X or Energy IC exception.
- Material issue after approval.

## Preservation Rules

- Keep `/investment-committee` as a top-level route.
- Preserve CloudMailIn IC bundle ingestion.
- Preserve useful cycle/deal data where it supports the weekly workflow.
- Preserve suppression of routine approved emails.
- Keep the UI calm, Blackhawk-native, and action-first.
