import { EXECUTIVE_BRIEF_SLOT_LABELS } from "@/lib/brief/executive-brief-snapshots";

export const D1_BINDING_NAME = "DB";

export const D1_TABLES = {
  users: "blackhawk_users",
  executiveBriefSnapshots: "executive_brief_snapshots",
  executiveBriefTaskCandidates: "executive_brief_task_candidates",
  meetingRecords: "meeting_records",
  people: "people",
  investmentCommitteeCycles: "investment_committee_cycles",
  agentRuns: "agent_runs",
  sourceMetadata: "source_metadata",
  migrationAuditEvents: "migration_audit_events"
} as const;

export const D1_EXECUTIVE_BRIEF_SLOT_LABELS = EXECUTIVE_BRIEF_SLOT_LABELS;

export const D1_SCHEMA_MIGRATION = "0001_sites_d1_initial";

export const D1_REQUIRED_JSON_COLUMNS = [
  "json_bundle",
  "structured_brief",
  "validation_warnings",
  "source_refs",
  "task_candidates",
  "research_summary",
  "post_meeting_summary",
  "attendees",
  "related_company_names",
  "related_people_names",
  "priority_reasons",
  "linked_task_ids",
  "metadata"
] as const;

export const D1_STRUCTURED_ONLY_EXCLUDED_COLUMNS = [
  "raw_email_body",
  "raw_email_html",
  "raw_email_headers",
  "raw_payload",
  "raw_request_body",
  "raw_graph_payload",
  "protected_context",
  "access_token",
  "refresh_token",
  "encrypted_access_token",
  "encrypted_refresh_token"
] as const;
