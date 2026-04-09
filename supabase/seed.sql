insert into public.users (id, email, full_name, timezone)
values (
  '11111111-1111-1111-1111-111111111111',
  'local@chief-of-staff.app',
  'Will O''Donnell',
  'America/Los_Angeles'
)
on conflict (email) do update
set full_name = excluded.full_name,
    timezone = excluded.timezone;

insert into public.people (
  id,
  user_id,
  slug,
  full_name,
  role_title,
  organization,
  status,
  importance,
  why_now_title,
  why_now_summary,
  quiet_state_note,
  protected_context,
  next_interaction_title,
  next_interaction_note,
  next_interaction_guidance,
  next_interaction_at,
  cadence_note,
  horizon_note,
  sort_order
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'amelia-hart',
  'Amelia Hart',
  'Board and recruiting partner',
  'Executive office',
  'active',
  1,
  'Amelia Hart matters now because she is the shortest path to keeping the board narrative coherent.',
  'She is the trusted translator between recruiting reality and board language. If her framing holds, tomorrow''s prep stays tight. If it drifts, the week gets noisier than it needs to be.',
  'No attention needed after tomorrow''s prep unless the role framing changes again.',
  'Personal family constraints are shaping her travel window this week.',
  'Tomorrow, 8:30 AM board-prep pass',
  'This is worth surfacing because it is soon and it directly affects the company narrative for the week.',
  'Keep the conversation to role framing and board language',
  timezone('utc', '2026-04-10 08:30:00 America/Los_Angeles'),
  'Best in small, high-context conversations. Over-briefing by email tends to dilute clarity rather than improve it.',
  'If the hiring loop stabilizes this month, her attention should fall back into a quiet state with no special handling.',
  0
)
on conflict (user_id, slug) do update
set full_name = excluded.full_name,
    role_title = excluded.role_title,
    organization = excluded.organization,
    status = excluded.status,
    importance = excluded.importance,
    why_now_title = excluded.why_now_title,
    why_now_summary = excluded.why_now_summary,
    quiet_state_note = excluded.quiet_state_note,
    protected_context = excluded.protected_context,
    next_interaction_title = excluded.next_interaction_title,
    next_interaction_note = excluded.next_interaction_note,
    next_interaction_guidance = excluded.next_interaction_guidance,
    next_interaction_at = excluded.next_interaction_at,
    cadence_note = excluded.cadence_note,
    horizon_note = excluded.horizon_note,
    sort_order = excluded.sort_order;

insert into public.commitments (
  id,
  user_id,
  person_id,
  title,
  summary,
  owner_type,
  owner_label,
  status,
  due_label,
  sort_order
)
values
(
  '44444444-4444-4444-4444-444444444441',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Confirm the narrowed hiring brief language',
  'She needs one crisp answer, not a long thread.',
  'self',
  'Will',
  'open',
  'Before board prep',
  0
),
(
  '44444444-4444-4444-4444-444444444442',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Send the revised candidate framing after the meeting',
  'This is queued but does not need active attention until the prep conversation ends.',
  'other',
  'Chief of staff',
  'quiet',
  'Tomorrow',
  1
)
on conflict (id) do update
set title = excluded.title,
    summary = excluded.summary,
    owner_type = excluded.owner_type,
    owner_label = excluded.owner_label,
    status = excluded.status,
    due_label = excluded.due_label,
    sort_order = excluded.sort_order;

insert into public.signals (
  id,
  user_id,
  person_id,
  signal_type,
  title,
  note,
  occurred_label,
  occurred_at,
  status,
  sort_order
)
values
(
  '55555555-5555-5555-5555-555555555551',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'interaction',
  'Quick scope check over text',
  'She flagged that the board draft was still assuming the broader version of the role.',
  'Yesterday',
  timezone('utc', '2026-04-08 17:00:00 America/Los_Angeles'),
  'active',
  0
),
(
  '55555555-5555-5555-5555-555555555552',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'interaction',
  'Twenty-minute recruiting sync',
  'Strong signal that she still wants a narrower, cleaner role narrative before externalizing anything.',
  'Monday',
  timezone('utc', '2026-04-06 14:00:00 America/Los_Angeles'),
  'active',
  1
),
(
  '55555555-5555-5555-5555-555555555553',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'interaction',
  'Dinner follow-up',
  'Personal tone was warm. Nothing from that exchange needs foreground attention right now.',
  'Last week',
  timezone('utc', '2026-04-02 19:30:00 America/Los_Angeles'),
  'quiet',
  2
)
on conflict (id) do update
set title = excluded.title,
    note = excluded.note,
    occurred_label = excluded.occurred_label,
    occurred_at = excluded.occurred_at,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into public.briefings (
  id,
  user_id,
  person_id,
  kind,
  title,
  body,
  sort_order
)
values
(
  '66666666-6666-6666-6666-666666666661',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'detail',
  'Relationship cadence',
  'Best in small, high-context conversations. Over-briefing by email tends to dilute clarity rather than improve it.',
  0
),
(
  '66666666-6666-6666-6666-666666666662',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'detail',
  'Longer horizon',
  'If the hiring loop stabilizes this month, her attention should fall back into a quiet state with no special handling.',
  1
)
on conflict (id) do update
set title = excluded.title,
    body = excluded.body,
    sort_order = excluded.sort_order;

insert into public.initiatives (
  id,
  user_id,
  slug,
  title,
  status,
  why_now_title,
  why_now_summary,
  attention_state_note,
  summary_title,
  summary_body,
  risk_framing,
  sort_order
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'executive-operating-rhythm',
  'Executive operating rhythm',
  'active',
  'Executive operating rhythm matters now because the board offsite is forcing strategy, staffing, and decision hygiene into the same conversation window.',
  'If the operating rhythm is framed clearly, the offsite becomes a converging point. If it stays fuzzy, the same work gets rediscovered in three different rooms.',
  'No additional attention is needed after Friday if the board framing lands cleanly.',
  'Create a calmer executive operating system for planning, triage, and follow-through.',
  'This initiative is about turning scattered executive work into a quieter operating surface. The immediate scope is not more tooling; it is cleaner visibility, better pacing, and fewer duplicated loops across inbox, people, initiatives, and commitments.',
  'The main tension is between building enough structure to help and adding enough interface to become noise.',
  0
)
on conflict (user_id, slug) do update
set title = excluded.title,
    status = excluded.status,
    why_now_title = excluded.why_now_title,
    why_now_summary = excluded.why_now_summary,
    attention_state_note = excluded.attention_state_note,
    summary_title = excluded.summary_title,
    summary_body = excluded.summary_body,
    risk_framing = excluded.risk_framing,
    sort_order = excluded.sort_order;

insert into public.initiative_items (
  id,
  user_id,
  initiative_id,
  section,
  label,
  title,
  body,
  sort_order
)
values
(
  '77777777-7777-7777-7777-777777777771',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'risk_point',
  null,
  null,
  'Pressure to surface more data could turn the product into a dashboard instead of a brief.',
  0
),
(
  '77777777-7777-7777-7777-777777777772',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'risk_point',
  null,
  null,
  'Several workflows are related, but merging them too early would blur decision ownership.',
  1
),
(
  '77777777-7777-7777-7777-777777777773',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'risk_point',
  null,
  null,
  'Board-offsite urgency can accidentally pull long-horizon operating work into short-term aesthetics.',
  2
),
(
  '77777777-7777-7777-7777-777777777774',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'key_change',
  'Today',
  'Capture flow is live inside the shared shell',
  'Context inheritance, privacy handling, and quiet confirmation behavior are now implemented.',
  0
),
(
  '77777777-7777-7777-7777-777777777775',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'key_change',
  'Today',
  'Priority Inbox is now triage-first',
  'The surfaced set is intentionally small, with compact rows and only rare elevated emphasis.',
  1
),
(
  '77777777-7777-7777-7777-777777777776',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'key_change',
  'Today',
  'People views now lead with relationship briefs',
  'The page hierarchy is oriented around why a person matters now rather than recent activity volume.',
  2
),
(
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'stakeholder',
  null,
  'Will',
  'Decision owner for pacing, product posture, and what earns foreground attention.',
  0
),
(
  '77777777-7777-7777-7777-777777777778',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'stakeholder',
  null,
  'Chief of staff workflows',
  'Primary proving ground for whether the system reduces noise instead of reorganizing it.',
  1
),
(
  '77777777-7777-7777-7777-777777777779',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'related_signal',
  null,
  null,
  'Board prep is exposing where narrative alignment and operating alignment diverge.',
  0
),
(
  '77777777-7777-7777-7777-777777777780',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'related_signal',
  null,
  null,
  'Inbox, People, and Capture are becoming the visible edge of one deeper executive rhythm problem.',
  1
),
(
  '77777777-7777-7777-7777-777777777781',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'related_signal',
  null,
  null,
  'Suppression quality is emerging as a more important success factor than relevance scoring.',
  2
),
(
  '77777777-7777-7777-7777-777777777782',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'open_loop',
  null,
  'Document the committed scope for the first executive workflows.',
  'Needed before the board offsite so the initiative is described as operating logic, not a loose product sketch.',
  0
),
(
  '77777777-7777-7777-7777-777777777783',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'open_loop',
  null,
  'Confirm what remains intentionally out of scope for this cycle.',
  'This prevents calmness from being eroded by opportunistic additions.',
  1
),
(
  '77777777-7777-7777-7777-777777777784',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'timeline_event',
  'Initial shell',
  'Responsive app foundation established',
  'One responsive web app, dark shell, mineral plane, and persistent cross-device navigation.',
  0
),
(
  '77777777-7777-7777-7777-777777777785',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'timeline_event',
  'Capture',
  'Always-available capture implemented',
  'Mobile center action and desktop persistent action now route into a shared capture flow.',
  1
),
(
  '77777777-7777-7777-7777-777777777786',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'timeline_event',
  'Current',
  'Strategic brief surfaces now being added by area',
  'Today, Inbox, People, and Initiatives are being shaped around distinct executive postures rather than generic lists.',
  2
),
(
  '77777777-7777-7777-7777-777777777787',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'linked_artifact',
  null,
  'Technical architecture memo',
  'Working record of shell decisions, capture flow, inbox decisions, and people-page posture.',
  0
),
(
  '77777777-7777-7777-7777-777777777788',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'linked_artifact',
  null,
  'Cursor rules and product defaults',
  'The governing constraints that keep the initiative from drifting into urgency-heavy design.',
  1
),
(
  '77777777-7777-7777-7777-777777777789',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'goal_marker',
  null,
  null,
  'The system reliably says when nothing needs attention right now.',
  0
),
(
  '77777777-7777-7777-7777-777777777790',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'goal_marker',
  null,
  null,
  'Executive screens read as briefs first, not dashboards or task managers.',
  1
),
(
  '77777777-7777-7777-7777-777777777791',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'goal_marker',
  null,
  null,
  'Capture, Inbox, People, and Initiatives reinforce one operating rhythm instead of four separate tools.',
  2
)
on conflict (id) do update
set section = excluded.section,
    label = excluded.label,
    title = excluded.title,
    body = excluded.body,
    sort_order = excluded.sort_order;
