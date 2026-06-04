import type { ChiefOfStaffSignal, ChiefOfStaffSignalSource } from "@/lib/chief-of-staff-signal";
import { classifyExecutiveWork, classifyInvestmentCommitteeSignal } from "@/lib/executive-work-adapters";
import type { PriorityInboxRecommendedAction, PriorityInboxSourceCandidate } from "@/lib/priority-inbox";

export const AGENT_SIGNAL_ROUTING_OUTCOMES = [
  "priority_inbox",
  "investment_committee",
  "suppressed_meta_admin",
  "suppressed_low_signal",
  "rejected_invalid"
] as const;

export type AgentSignalRoutingOutcome = (typeof AGENT_SIGNAL_ROUTING_OUTCOMES)[number];

export type AgentSignalRouteDecision = {
  outcome: AgentSignalRoutingOutcome;
  reason: string;
  investmentCommitteeMatchedCues: string[];
  requiresDirectWillAction: boolean;
};

const META_ADMIN_KEYWORDS = [
  "codex",
  "chatgpt",
  "prompt writing",
  "prompt engineering",
  "json schema",
  "json contract",
  "agent instructions",
  "agent configuration",
  "handoff instructions",
  "integration design",
  "app architecture",
  "local repo work",
  "github workflow",
  "goal contract",
  "tooling setup",
  "priority inbox implementation process",
  "administrative process about configuring the agent",
  "repo",
  "implementation planning"
] as const;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stringifyMetadata(value: unknown) {
  if (!value) {
    return "";
  }

  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return "";
  }
}

function signalText(signal: ChiefOfStaffSignal) {
  return normalizeText(
    [
      signal.title,
      signal.summary,
      signal.whyItMatters,
      signal.actionRequest,
      signal.sourceLabel,
      signal.sourceReference,
      signal.owner,
      ...signal.participants,
      stringifyMetadata(signal.metadata)
    ].join(" ")
  );
}

function isMetaAdminSignal(signal: ChiefOfStaffSignal) {
  const combined = signalText(signal);
  return META_ADMIN_KEYWORDS.some((keyword) => combined.includes(keyword));
}

function isLowSignalSuppressionCandidate(signal: ChiefOfStaffSignal) {
  const classification = classifyExecutiveWork({
    title: signal.title,
    summary: signal.summary,
    body: [signal.whyItMatters, signal.actionRequest].filter(Boolean).join(" "),
    category: signal.category,
    sourceType: signal.source === "calendar" ? "calendar" : signal.source,
    signalType: signal.signalType
  });

  if (classification.workType === "noise") {
    return true;
  }

  return (
    signal.attention === "low" &&
    !signal.actionRequest &&
    !signal.dueAt &&
    signal.signalType === "status"
  );
}

export function routeAgentSignal(signal: ChiefOfStaffSignal): AgentSignalRouteDecision {
  if (!signal.id.trim() || !signal.title.trim() || !signal.summary.trim()) {
    return {
      outcome: "rejected_invalid",
      reason: "Signal is missing one or more required fields.",
      investmentCommitteeMatchedCues: [],
      requiresDirectWillAction: false
    };
  }

  if (isMetaAdminSignal(signal)) {
    return {
      outcome: "suppressed_meta_admin",
      reason: "Signal content is primarily meta, admin, tooling, or implementation process.",
      investmentCommitteeMatchedCues: [],
      requiresDirectWillAction: false
    };
  }

  const investmentCommittee = classifyInvestmentCommitteeSignal({
    title: signal.title,
    summary: signal.summary,
    body: [signal.whyItMatters, signal.actionRequest].filter(Boolean).join(" "),
    sourceLabel: signal.sourceLabel,
    participants: signal.participants,
    owner: signal.owner,
    category: signal.category,
    metadataText: [signal.sourceReference, stringifyMetadata(signal.metadata)].filter(Boolean).join(" ")
  });

  if (investmentCommittee.isInvestmentCommittee) {
    return {
      outcome: "investment_committee",
      reason:
        investmentCommittee.matchedCues.length > 0
          ? `Routed to Investment Committee: ${investmentCommittee.matchedCues.join(", ")}.`
          : "Routed to Investment Committee.",
      investmentCommitteeMatchedCues: investmentCommittee.matchedCues,
      requiresDirectWillAction: investmentCommittee.requiresDirectWillAction
    };
  }

  if (isLowSignalSuppressionCandidate(signal)) {
    return {
      outcome: "suppressed_low_signal",
      reason: "Signal was classified as low-signal or non-actionable server-side.",
      investmentCommitteeMatchedCues: [],
      requiresDirectWillAction: false
    };
  }

  return {
    outcome: "priority_inbox",
    reason: "Signal is eligible for the Priority Inbox.",
    investmentCommitteeMatchedCues: [],
    requiresDirectWillAction: false
  };
}

function sourceFamilyForSignal(source: ChiefOfStaffSignalSource): PriorityInboxSourceCandidate["sourceFamily"] {
  switch (source) {
    case "teams":
      return "teams";
    case "calendar":
      return "calendar";
    case "outlook":
    default:
      return "email";
  }
}

function recommendedActionForSignal(signal: ChiefOfStaffSignal): PriorityInboxRecommendedAction {
  if (signal.signalType === "decision" || signal.signalType === "follow_up" || signal.signalType === "meeting") {
    return "create_task";
  }

  if (signal.actionRequest) {
    return "create_task";
  }

  return "save_reference";
}

function visibleStateForSignal(signal: ChiefOfStaffSignal): PriorityInboxSourceCandidate["visibleState"] {
  return signal.attention === "high" ? "high_priority" : "needs_review";
}

function senderForSignal(signal: ChiefOfStaffSignal) {
  if (signal.participants.length > 0) {
    return signal.participants.filter((participant) => participant !== signal.owner).join(", ") || signal.owner;
  }

  return signal.owner;
}

export function buildPriorityInboxCandidateFromAgentSignal(
  signal: ChiefOfStaffSignal,
  route: AgentSignalRouteDecision
): PriorityInboxSourceCandidate {
  const associatedWith = `${signal.sourceLabel} · ${signal.title}`;
  const sourceReference = signal.sourceReference?.trim() ?? "";
  const whyItMatters = signal.whyItMatters?.trim() ?? signal.summary;

  return {
    source: signal.source,
    sourceLabel:
      signal.source === "calendar" && !signal.sourceLabel.toLowerCase().includes("calendar")
        ? "Outlook Calendar"
        : signal.sourceLabel,
    sourceFamily: sourceFamilyForSignal(signal.source),
    ingestionMode: "agent_run",
    sourceLink: signal.sourceUrl,
    externalMessageId: signal.id,
    conversationId: null,
    receivedAt: signal.occurredAt,
    sender: senderForSignal(signal),
    senderRole: signal.owner,
    subject: signal.title,
    primaryLine: signal.actionRequest ?? whyItMatters,
    snippet: signal.summary,
    visibleState: visibleStateForSignal(signal),
    whySurfaced: whyItMatters,
    supportingSignals: [signal.signalType, signal.attention, signal.sourceLabel].filter(Boolean),
    recommendedAction: recommendedActionForSignal(signal),
    dispositionReason:
      signal.signalType === "decision"
        ? "decision_needed"
        : signal.signalType === "follow_up"
          ? "follow_up_needed"
          : signal.signalType === "meeting"
            ? "reply_needed"
            : "business_context",
    updatedCue: signal.dueAt ? `Due ${signal.dueAt}` : null,
    relationshipCue: sourceReference || null,
    sensitiveContext: signal.protectedContext ? signal.summary : null,
    groupedCue: route.requiresDirectWillAction ? "Direct Will action" : null,
    taskPrefill: {
      description: signal.actionRequest ?? signal.title,
      nextStep: signal.actionRequest ?? whyItMatters,
      desiredOutcome: whyItMatters,
      priority: signal.attention,
      categoryName: signal.signalType === "meeting" ? "Calendar" : "Priority Action",
      associatedWith
    },
    commitmentPrefill: {
      statement: signal.actionRequest ?? signal.title,
      owedTo: signal.owner,
      dueLabel: signal.dueAt ?? "No explicit deadline",
      contextNote: whyItMatters,
      associatedWith
    },
    referencePrefill: {
      title: signal.title,
      summary: signal.summary
    },
    sourceMetadata: {
      agentSignalId: signal.id,
      sourceReference: signal.sourceReference ?? null,
      whyItMatters: signal.whyItMatters ?? null,
      participants: signal.participants,
      protectedContext: signal.protectedContext,
      category: signal.category ?? null
    }
  };
}
