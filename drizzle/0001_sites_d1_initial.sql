PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS blackhawk_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS executive_brief_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('7 AM', '11 AM', '1 PM', '3 PM', '5 PM', '7 PM', 'Manual')),
  generated_at TEXT,
  display_date TEXT,
  human_brief TEXT,
  json_bundle TEXT,
  structured_brief TEXT,
  contract_version TEXT,
  validation_warnings TEXT NOT NULL DEFAULT '[]',
  source_message_id TEXT,
  source_run_id TEXT,
  source_kind TEXT NOT NULL DEFAULT 'codex_agent',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS executive_brief_snapshots_user_source_message_idx
  ON executive_brief_snapshots(user_id, source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS executive_brief_snapshots_user_generated_idx
  ON executive_brief_snapshots(user_id, generated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS executive_brief_task_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES executive_brief_snapshots(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low') OR priority IS NULL),
  recommended_action TEXT,
  due_at TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  source_lane TEXT CHECK (source_lane IN ('email', 'calendar_meetings', 'teams') OR source_lane IS NULL),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'dismissed', 'created', 'already_exists')),
  linked_task_id TEXT,
  linked_task_href TEXT,
  linked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS executive_brief_task_candidates_snapshot_idx
  ON executive_brief_task_candidates(snapshot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meeting_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  calendar_event_id TEXT NOT NULL,
  calendar_source_system_id TEXT NOT NULL DEFAULT 'outlook',
  title TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  organizer_name TEXT,
  organizer_email TEXT,
  attendees TEXT NOT NULL DEFAULT '[]',
  internal_external_classification TEXT NOT NULL DEFAULT 'unknown',
  related_company_names TEXT NOT NULL DEFAULT '[]',
  related_people_names TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT 'normal',
  priority_reasons TEXT NOT NULL DEFAULT '[]',
  research_status TEXT NOT NULL DEFAULT 'not_researched',
  research_requested_at TEXT,
  research_completed_at TEXT,
  research_summary TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  transcript_status TEXT NOT NULL DEFAULT 'none',
  transcript_refs TEXT NOT NULL DEFAULT '[]',
  post_meeting_status TEXT NOT NULL DEFAULT 'not_started',
  post_meeting_summary TEXT,
  task_candidates TEXT NOT NULL DEFAULT '[]',
  linked_task_ids TEXT NOT NULL DEFAULT '[]',
  obsidian_export_status TEXT NOT NULL DEFAULT 'not_exported',
  obsidian_exported_at TEXT,
  obsidian_email_to TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, calendar_source_system_id, calendar_event_id)
);

CREATE INDEX IF NOT EXISTS meeting_records_user_start_idx
  ON meeting_records(user_id, start_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  role TEXT,
  relationship_context TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS people_user_email_idx
  ON people(user_id, email);

CREATE TABLE IF NOT EXISTS investment_committee_cycles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  cycle_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  structured_bundle TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, cycle_key)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  run_kind TEXT NOT NULL,
  slot TEXT,
  status TEXT NOT NULL,
  requested_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  source_refs TEXT NOT NULL DEFAULT '[]',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS agent_runs_user_created_idx
  ON agent_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS source_metadata (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES blackhawk_users(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_system_id TEXT,
  source_url TEXT,
  source_label TEXT,
  captured_at TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS migration_audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES blackhawk_users(id) ON DELETE SET NULL,
  migration_name TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT,
  target_table TEXT NOT NULL,
  target_id TEXT,
  excluded_columns TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
