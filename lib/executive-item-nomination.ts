export const ATTENTION_REASONS = [
  "will_action_required",
  "someone_waiting_on_will",
  "deadline_approaching",
  "meeting_prep_required",
  "material_new_information",
  "momentum_changed",
  "risk_increased",
  "ambiguity_increased",
  "key_relationship_requires_attention",
  "executive_capacity_at_risk",
  "manually_pinned",
  "ic_x_detected",
  "energy_ic_detected",
  "will_mentioned",
  "material_peer_question_activity",
  "exception_or_unusual_status",
  "will_questions_not_sent",
  "package_missing_after_expected_timing"
] as const;

export const SUPPRESSION_REASONS = [
  "standing_workflow_normal_cadence",
  "important_but_not_active",
  "no_will_specific_role",
  "no_clear_next_action",
  "weak_evidence",
  "informational_only",
  "already_resolved",
  "explicitly_deprioritized",
  "routine_ic_approval",
  "normal_ic_process"
] as const;

export type AttentionReason = (typeof ATTENTION_REASONS)[number];
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export type ExecutiveItemCandidatePriority = "low" | "medium" | "high";

export type ExecutiveItemCandidateEvidence = {
  label: string;
  value: string;
  href?: string | null;
};

export type ExecutiveItemCandidate = {
  id: string;
  title: string;
  summary: string;
  recommendedAction: string;
  sourceWorkflow: string;
  sourceEntityType: string;
  sourceEntityId: string;
  href: string | null;
  dueAt: string | null;
  priority: ExecutiveItemCandidatePriority;
  attentionReasons: AttentionReason[];
  suppressionReasons: SuppressionReason[];
  evidence: ExecutiveItemCandidateEvidence[];
  generatedAt: string;
};

export function formatAttentionReason(reason: AttentionReason) {
  switch (reason) {
    case "will_action_required":
      return "Will action required";
    case "someone_waiting_on_will":
      return "Someone waiting on Will";
    case "deadline_approaching":
      return "Deadline approaching";
    case "meeting_prep_required":
      return "Meeting prep required";
    case "material_new_information":
      return "Material new information";
    case "momentum_changed":
      return "Momentum changed";
    case "risk_increased":
      return "Risk increased";
    case "ambiguity_increased":
      return "Ambiguity increased";
    case "key_relationship_requires_attention":
      return "Key relationship requires attention";
    case "executive_capacity_at_risk":
      return "Executive capacity at risk";
    case "manually_pinned":
      return "Manually pinned";
    case "ic_x_detected":
      return "IC X detected";
    case "energy_ic_detected":
      return "Energy IC detected";
    case "will_mentioned":
      return "Will mentioned";
    case "material_peer_question_activity":
      return "Material peer-question activity";
    case "exception_or_unusual_status":
      return "Exception or unusual status";
    case "will_questions_not_sent":
      return "Will questions not marked sent";
    case "package_missing_after_expected_timing":
      return "Package missing after expected timing";
  }
}

export function formatSuppressionReason(reason: SuppressionReason) {
  switch (reason) {
    case "standing_workflow_normal_cadence":
      return "Standing workflow normal cadence";
    case "important_but_not_active":
      return "Important but not active";
    case "no_will_specific_role":
      return "No Will-specific role";
    case "no_clear_next_action":
      return "No clear next action";
    case "weak_evidence":
      return "Weak evidence";
    case "informational_only":
      return "Informational only";
    case "already_resolved":
      return "Already resolved";
    case "explicitly_deprioritized":
      return "Explicitly deprioritized";
    case "routine_ic_approval":
      return "Routine IC approval";
    case "normal_ic_process":
      return "Normal IC process";
  }
}

export function createExecutiveItemCandidate(input: Omit<ExecutiveItemCandidate, "generatedAt" | "suppressionReasons"> & {
  generatedAt?: string;
  suppressionReasons?: SuppressionReason[];
}): ExecutiveItemCandidate {
  return {
    ...input,
    suppressionReasons: input.suppressionReasons ?? [],
    generatedAt: input.generatedAt ?? new Date().toISOString()
  };
}

export function suppressExecutiveItemCandidate(
  candidate: ExecutiveItemCandidate,
  ...suppressionReasons: SuppressionReason[]
): ExecutiveItemCandidate {
  return {
    ...candidate,
    suppressionReasons: [...new Set([...candidate.suppressionReasons, ...suppressionReasons])]
  };
}

export function shouldNominateExecutiveItem(candidate: ExecutiveItemCandidate) {
  return candidate.attentionReasons.length > 0 && candidate.suppressionReasons.length === 0;
}
