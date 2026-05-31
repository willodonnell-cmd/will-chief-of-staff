export const EXECUTIVE_WORK_TYPES = [
  "strategic_initiative",
  "opportunity",
  "decision",
  "meeting",
  "relationship",
  "delegation",
  "logistics",
  "reference",
  "noise"
] as const;

export type ExecutiveWorkType = (typeof EXECUTIVE_WORK_TYPES)[number];

export const EXECUTIVE_WORK_TYPE_LABELS: Record<ExecutiveWorkType, string> = {
  strategic_initiative: "Strategic Initiative",
  opportunity: "Deal / Opportunity",
  decision: "Decision / Governance",
  meeting: "Meeting Prep / Debrief",
  relationship: "Relationship",
  delegation: "Delegation / Waiting On",
  logistics: "Logistics / Admin",
  reference: "Reference",
  noise: "Noise"
};

export const EXECUTIVE_PRIORITIES = ["high", "medium", "low"] as const;

export type ExecutivePriority = (typeof EXECUTIVE_PRIORITIES)[number];

export const EXECUTIVE_PRIORITY_LABELS: Record<ExecutivePriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

export const EXECUTIVE_RECOMMENDED_ACTIONS = [
  "review",
  "decide",
  "prepare",
  "follow_up",
  "delegate",
  "wait",
  "advance",
  "route",
  "schedule",
  "archive",
  "ignore"
] as const;

export type ExecutiveRecommendedAction = (typeof EXECUTIVE_RECOMMENDED_ACTIONS)[number];

export const EXECUTIVE_RECOMMENDED_ACTION_LABELS: Record<ExecutiveRecommendedAction, string> = {
  review: "Review",
  decide: "Decide",
  prepare: "Prepare",
  follow_up: "Follow up",
  delegate: "Delegate",
  wait: "Wait",
  advance: "Advance",
  route: "Route",
  schedule: "Schedule",
  archive: "Archive",
  ignore: "Ignore"
};

export const EXECUTIVE_SIGNAL_SOURCE_TYPES = [
  "agent_signal",
  "calendar",
  "capture",
  "forwarded_email",
  "gmail",
  "library",
  "manual",
  "outlook",
  "outlook_calendar",
  "priority_inbox",
  "teams"
] as const;

export type ExecutiveSignalSourceType = (typeof EXECUTIVE_SIGNAL_SOURCE_TYPES)[number];

export const EXECUTIVE_SIGNAL_ORIGINS = [
  "agent_brief",
  "library",
  "live_calendar",
  "priority_inbox"
] as const;

export type ExecutiveSignalOrigin = (typeof EXECUTIVE_SIGNAL_ORIGINS)[number];

export type ExecutiveSignalStatus = string;

export type ExecutiveSignal = {
  id: string;
  title: string;
  summary: string;
  source_type: ExecutiveSignalSourceType;
  source_origin?: ExecutiveSignalOrigin | null;
  source_id: string;
  source_label: string;
  source_received_at?: string | null;
  work_type: ExecutiveWorkType;
  priority?: ExecutivePriority | null;
  category?: string | null;
  status?: ExecutiveSignalStatus | null;
  related_persons?: string[];
  related_companies?: string[];
  related_initiatives?: string[];
  recommended_action?: ExecutiveRecommendedAction | null;
  next_step?: string | null;
  desired_outcome?: string | null;
  owner?: string | null;
  delegated_to?: string | null;
  waiting_on?: string | null;
  due_at?: string | null;
  confidence?: number | null;
  evidence_snippets?: string[];
  href?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const OPPORTUNITY_STATUSES = [
  "new",
  "reviewing",
  "delegated_diligence",
  "awaiting_response",
  "follow_up_scheduled",
  "active",
  "watch",
  "deferred",
  "killed",
  "closed"
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_RECOMMENDED_ACTIONS = [
  "advance",
  "delegate_diligence",
  "ask_for_more_info",
  "route_to_owner",
  "schedule_follow_up",
  "save_as_watch",
  "kill_politely"
] as const;

export type OpportunityRecommendedAction = (typeof OPPORTUNITY_RECOMMENDED_ACTIONS)[number];

export type Opportunity = {
  id: string;
  company_or_counterparty: string;
  title: string;
  source_relationship?: string | null;
  strategic_relevance?: string | null;
  theme?: string | null;
  why_prologis_should_care?: string | null;
  internal_owner?: string | null;
  next_decision?: string | null;
  status: OpportunityStatus;
  evidence: string[];
  pitchbook_enrichment_status?: "not_started" | "pending" | "enriched" | "unavailable" | null;
  meeting_history: string[];
  last_touch_at?: string | null;
  recommended_action?: OpportunityRecommendedAction | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const DECISION_PREP_STATUSES = [
  "needs_review",
  "needs_recommendation",
  "ready_for_decision",
  "decided",
  "delegated",
  "deferred",
  "closed"
] as const;

export type DecisionPrepStatus = (typeof DECISION_PREP_STATUSES)[number];

export type DecisionPrep = {
  id: string;
  title: string;
  decision_question: string;
  recommendation?: string | null;
  options: string[];
  risks: string[];
  evidence: string[];
  people_involved: string[];
  deadline?: string | null;
  related_initiative?: string | null;
  related_opportunity?: string | null;
  decision_status: DecisionPrepStatus;
  resulting_commitments: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export const MEETING_ASSET_CLASSIFICATIONS = [
  "meeting_note",
  "decision",
  "commitment",
  "waiting_on_item",
  "opportunity_update",
  "initiative_update",
  "relationship_note",
  "reference_only",
  "no_action"
] as const;

export type MeetingAssetClassification = (typeof MEETING_ASSET_CLASSIFICATIONS)[number];

export type KeyInitiative = {
  id: string;
  name: string;
  current_focus?: string | null;
  latest_movement?: string | null;
  blocker?: string | null;
  recommended_action?: ExecutiveRecommendedAction | null;
  related_signal_count?: number | null;
  href?: string | null;
  updated_at?: string | null;
};

export function isExecutiveWorkType(value: string | null | undefined): value is ExecutiveWorkType {
  return typeof value === "string" && EXECUTIVE_WORK_TYPES.includes(value as ExecutiveWorkType);
}

export function getExecutiveWorkTypeLabel(value: ExecutiveWorkType) {
  return EXECUTIVE_WORK_TYPE_LABELS[value];
}

export function normalizeExecutiveWorkType(value: string | null | undefined) {
  return isExecutiveWorkType(value) ? value : null;
}

export function isExecutivePriority(value: string | null | undefined): value is ExecutivePriority {
  return typeof value === "string" && EXECUTIVE_PRIORITIES.includes(value as ExecutivePriority);
}

export function getExecutivePriorityLabel(value: ExecutivePriority) {
  return EXECUTIVE_PRIORITY_LABELS[value];
}

export function normalizeExecutivePriority(value: string | null | undefined) {
  return isExecutivePriority(value) ? value : null;
}

export function isExecutiveRecommendedAction(
  value: string | null | undefined
): value is ExecutiveRecommendedAction {
  return (
    typeof value === "string" &&
    EXECUTIVE_RECOMMENDED_ACTIONS.includes(value as ExecutiveRecommendedAction)
  );
}

export function getExecutiveRecommendedActionLabel(value: ExecutiveRecommendedAction) {
  return EXECUTIVE_RECOMMENDED_ACTION_LABELS[value];
}

export function normalizeExecutiveRecommendedAction(value: string | null | undefined) {
  return isExecutiveRecommendedAction(value) ? value : null;
}
