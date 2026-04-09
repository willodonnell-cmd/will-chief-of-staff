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
