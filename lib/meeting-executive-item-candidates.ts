import {
  registerExecutiveItemCandidates,
  type ExecutiveItemRegistryEntry
} from "@/lib/executive-item-candidate-registry";
import {
  createExecutiveItemCandidate,
  type AttentionReason,
  type ExecutiveItemCandidate,
  type ExecutiveItemCandidateEvidence
} from "@/lib/executive-item-nomination";
import {
  normalizeMeetingTaskCandidates,
  type JsonValue,
  type MeetingRecord
} from "@/lib/meetings/meeting-records";

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function jsonRecord(value: JsonValue | null | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, JsonValue> : null;
}

function stringField(value: JsonValue | undefined) {
  return typeof value === "string" ? compactText(value) : "";
}

function arrayField(value: JsonValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function sourceHref(value: JsonValue) {
  const record = jsonRecord(value);
  if (!record) {
    return null;
  }

  return stringField(record.href) || stringField(record.url) || stringField(record.sourceUrl) || null;
}

function sourceLabel(value: JsonValue) {
  const record = jsonRecord(value);
  if (!record) {
    return typeof value === "string" ? compactText(value) : "";
  }

  return stringField(record.title) || stringField(record.label) || stringField(record.sourceType) || stringField(record.briefItemId);
}

function isSuppressedMeeting(record: MeetingRecord) {
  const title = compactText(record.title).toLowerCase();
  const reasonText = record.priorityReasons.join(" ").toLowerCase();
  const combined = `${title} ${reasonText}`;

  return (
    record.priority === "low" ||
    /\b(cancelled|canceled)\b/.test(combined) ||
    /\b(focus time|focus hold|focus block|hold|placeholder|travel|commute|flight|drive|logistics|reference only)\b/.test(combined) ||
    /\bduplicate calendar artifact\b/.test(combined) ||
    /\b1:1\b/.test(title) && !/\b(prep|decision|board|elt|customer|investor|partner|follow[- ]?up|risk)\b/.test(combined)
  );
}

function nextBusinessDay(date: Date) {
  const value = new Date(date);
  value.setDate(value.getDate() + 1);
  while (value.getDay() === 0 || value.getDay() === 6) {
    value.setDate(value.getDate() + 1);
  }
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function isTodayOrNextBusinessDay(value: string | null, now: Date) {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return false;
  }

  return parsed <= endOfDay(nextBusinessDay(now)).getTime();
}

function hasResearchMaterial(record: MeetingRecord) {
  const summary = jsonRecord(record.researchSummary);
  if (!summary) {
    return false;
  }

  return Boolean(
    stringField(summary.highLevelContext) ||
      arrayField(summary.keyPriorities).length > 0 ||
      arrayField(summary.suggestedQuestions).length > 0 ||
      arrayField(summary.recentRelevantActivity).length > 0 ||
      arrayField(summary.relevantLinks).length > 0
  );
}

function hasPostMeetingOpenLoops(record: MeetingRecord) {
  const summary = jsonRecord(record.postMeetingSummary);
  if (!summary) {
    return false;
  }

  return arrayField(summary.actionItemCandidates).length > 0 || arrayField(summary.risksOrOpenIssues).length > 0;
}

function meetingHasPrepBurden(record: MeetingRecord) {
  const taskCandidates = normalizeMeetingTaskCandidates(record.taskCandidates, record.id);
  const reasonText = record.priorityReasons.join(" ").toLowerCase();
  const title = compactText(record.title).toLowerCase();

  return (
    /\b(prep|prepare|packet|brief|readout|review)\b/.test(`${title} ${reasonText}`) ||
    hasResearchMaterial(record) ||
    taskCandidates.some((candidate) => candidate.status === "candidate" && ["prep", "review", "decision"].includes(candidate.taskType))
  );
}

function meetingLooksStrategic(record: MeetingRecord) {
  const combined = [
    record.title,
    ...record.relatedCompanyNames,
    ...record.relatedPeopleNames,
    ...record.priorityReasons
  ].join(" ").toLowerCase();

  return (
    record.priority === "high" ||
    record.priority === "critical" ||
    /\b(board|elt|executive leadership|direct report|key customer|customer|investor|partner|major initiative|strategic|approval|capital|investment committee)\b/.test(combined)
  );
}

function meetingHasDecisionRisk(record: MeetingRecord) {
  const summary = jsonRecord(record.researchSummary);
  const situationRead = jsonRecord(summary?.situationRead);
  const categories = arrayField(situationRead?.categories).filter((value): value is string => typeof value === "string");
  const combined = [record.title, ...record.priorityReasons, stringField(situationRead?.summary)].join(" ").toLowerCase();

  return categories.includes("decision_pressure") || /\b(decision|approve|approval|risk|escalat|friction|alignment)\b/.test(combined);
}

function meetingCreatesCapacityRisk(record: MeetingRecord) {
  const combined = [record.title, ...record.priorityReasons].join(" ").toLowerCase();
  return record.priority === "critical" || /\b(capacity|back[- ]?to[- ]?back|overlap|compressed|time sensitive)\b/.test(combined);
}

function attentionReasonsForMeeting(record: MeetingRecord, now: Date): AttentionReason[] {
  const reasons = new Set<AttentionReason>();
  const prepBurden = meetingHasPrepBurden(record);

  if (isTodayOrNextBusinessDay(record.startAt, now) && prepBurden) {
    reasons.add("meeting_prep_required");
    reasons.add("deadline_approaching");
  }

  if (meetingLooksStrategic(record)) {
    reasons.add("key_relationship_requires_attention");
  }

  if (hasResearchMaterial(record)) {
    reasons.add("material_new_information");
    reasons.add("meeting_prep_required");
  }

  if (hasPostMeetingOpenLoops(record)) {
    reasons.add("will_action_required");
    reasons.add("someone_waiting_on_will");
  }

  if (meetingHasDecisionRisk(record)) {
    reasons.add("risk_increased");
  }

  if (meetingCreatesCapacityRisk(record)) {
    reasons.add("executive_capacity_at_risk");
  }

  return [...reasons];
}

function recommendedAction(record: MeetingRecord, reasons: AttentionReason[]) {
  if (reasons.includes("will_action_required") || reasons.includes("someone_waiting_on_will")) {
    return "Review the meeting follow-up context and decide the next move.";
  }

  if (reasons.includes("meeting_prep_required")) {
    return "Review the meeting research, prep priorities, and suggested questions before the meeting.";
  }

  if (reasons.includes("risk_increased")) {
    return "Review the decision risk and clarify Will's position before the meeting.";
  }

  if (reasons.includes("key_relationship_requires_attention")) {
    return "Review the relationship context and enter the meeting with a clear objective.";
  }

  return "";
}

function summaryText(record: MeetingRecord, reasons: AttentionReason[]) {
  const summary = jsonRecord(record.researchSummary);
  const context = stringField(summary?.highLevelContext);
  if (context) {
    return context;
  }

  if (reasons.includes("will_action_required")) {
    return "Meeting follow-up has unresolved action or risk context that may require Will's attention.";
  }

  return "Meeting has a current executive attention trigger based on existing meeting context.";
}

function evidenceForMeeting(record: MeetingRecord): ExecutiveItemCandidateEvidence[] {
  const evidence: ExecutiveItemCandidateEvidence[] = [];
  if (record.startAt) {
    evidence.push({ label: "Start", value: record.startAt });
  }
  if (record.organizerName || record.organizerEmail) {
    evidence.push({ label: "Organizer", value: [record.organizerName, record.organizerEmail].filter(Boolean).join(" · ") });
  }
  for (const reason of record.priorityReasons.slice(0, 2)) {
    evidence.push({ label: "Priority reason", value: reason });
  }
  for (const ref of record.sourceRefs) {
    const label = sourceLabel(ref);
    const href = sourceHref(ref);
    if (label || href) {
      evidence.push({ label: "Source", value: label || href || "Source", href });
    }
  }

  return evidence;
}

function priorityForMeeting(record: MeetingRecord, reasons: AttentionReason[]): ExecutiveItemCandidate["priority"] {
  if (record.priority === "critical" || reasons.includes("executive_capacity_at_risk") || reasons.includes("risk_increased")) {
    return "high";
  }

  if (record.priority === "high" || reasons.includes("meeting_prep_required") || reasons.includes("will_action_required")) {
    return "medium";
  }

  return "low";
}

export function buildMeetingExecutiveItemCandidates(records: MeetingRecord[], now = new Date()): ExecutiveItemCandidate[] {
  const generatedAt = now.toISOString();

  return records
    .map((record): ExecutiveItemCandidate | null => {
      if (isSuppressedMeeting(record)) {
        return null;
      }

      const attentionReasons = attentionReasonsForMeeting(record, now);
      const action = recommendedAction(record, attentionReasons);
      if (attentionReasons.length === 0 || !action) {
        return null;
      }

      return createExecutiveItemCandidate({
        id: `meeting:${record.id}`,
        title: record.title,
        summary: summaryText(record, attentionReasons),
        recommendedAction: action,
        sourceWorkflow: "meeting_records",
        sourceEntityType: "meeting_record",
        sourceEntityId: record.id,
        href: null,
        dueAt: record.startAt,
        priority: priorityForMeeting(record, attentionReasons),
        attentionReasons,
        evidence: evidenceForMeeting(record),
        generatedAt
      });
    })
    .filter((candidate): candidate is ExecutiveItemCandidate => Boolean(candidate));
}

export function buildMeetingCandidateRegistryEntries(records: MeetingRecord[], now = new Date()): ExecutiveItemRegistryEntry[] {
  return records.flatMap((record) =>
    registerExecutiveItemCandidates({
      candidates: buildMeetingExecutiveItemCandidates([record], now),
      sourceType: "meeting",
      sourceId: record.id,
      sourceLabel: "Meeting",
      generatedAt: now.toISOString(),
      now
    })
  );
}
