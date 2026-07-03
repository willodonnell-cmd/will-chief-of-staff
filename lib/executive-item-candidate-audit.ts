import {
  EXECUTIVE_ITEM_SOURCE_TYPES,
  type ExecutiveItemRegistryEntry,
  type ExecutiveItemSourceType
} from "@/lib/executive-item-candidate-registry";
import {
  buildCandidateInteractionKey,
  isCandidateSuppressedByInteraction,
  type CandidateInteractionAction,
  type ExecutiveItemCandidateInteraction
} from "@/lib/executive-item-candidate-interactions";
import type { AttentionReason, SuppressionReason } from "@/lib/executive-item-nomination";

export type ExecutiveItemCandidateAuditRow = {
  title: string;
  candidateId: string;
  sourceType: ExecutiveItemSourceType;
  sourceId: string;
  sourceLabel: string;
  interactionKey: string;
  eligibleForToday: boolean;
  eligibilityReason: string;
  suppressedByInteraction: boolean;
  interactionAction: CandidateInteractionAction | null;
  snoozedUntil: string | null;
  attentionReasons: AttentionReason[];
  suppressionReasons: SuppressionReason[];
  priority: ExecutiveItemRegistryEntry["candidate"]["priority"];
  displayRank: number;
  recommendedAction: string;
  generatedAt: string;
};

export type ExecutiveItemCandidateAuditSummary = {
  total: number;
  eligible: number;
  ineligible: number;
  active: number;
  suppressedByInteraction: number;
  bySourceType: Record<ExecutiveItemSourceType, number>;
  byAction: Record<CandidateInteractionAction, number>;
};

export type ExecutiveItemCandidateAuditViewModel = {
  entries: ExecutiveItemCandidateAuditRow[];
  summary: ExecutiveItemCandidateAuditSummary;
};

function emptySourceCounts() {
  return Object.fromEntries(EXECUTIVE_ITEM_SOURCE_TYPES.map((sourceType) => [sourceType, 0])) as Record<
    ExecutiveItemSourceType,
    number
  >;
}

function emptyActionCounts() {
  return {
    dismissed: 0,
    snoozed: 0,
    reviewed: 0
  } satisfies Record<CandidateInteractionAction, number>;
}

export function buildExecutiveItemCandidateAuditViewModel(
  entries: ExecutiveItemRegistryEntry[],
  interactions: ExecutiveItemCandidateInteraction[],
  now = new Date()
): ExecutiveItemCandidateAuditViewModel {
  const interactionsByKey = new Map(interactions.map((interaction) => [interaction.interactionKey, interaction]));
  const bySourceType = emptySourceCounts();
  const byAction = emptyActionCounts();
  let eligible = 0;
  let suppressedByInteraction = 0;

  const rows = entries.map((entry): ExecutiveItemCandidateAuditRow => {
    const interactionKey = buildCandidateInteractionKey(entry);
    const interaction = interactionsByKey.get(interactionKey) ?? null;
    const isSuppressed = isCandidateSuppressedByInteraction(entry, interactions, now);

    bySourceType[entry.sourceType] += 1;
    if (entry.eligibleForToday) {
      eligible += 1;
    }
    if (isSuppressed) {
      suppressedByInteraction += 1;
    }
    if (interaction) {
      byAction[interaction.action] += 1;
    }

    return {
      title: entry.candidate.title,
      candidateId: entry.candidate.id,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      sourceLabel: entry.sourceLabel,
      interactionKey,
      eligibleForToday: entry.eligibleForToday,
      eligibilityReason: entry.eligibilityReason,
      suppressedByInteraction: isSuppressed,
      interactionAction: interaction?.action ?? null,
      snoozedUntil: interaction?.snoozedUntil ?? null,
      attentionReasons: entry.candidate.attentionReasons,
      suppressionReasons: entry.candidate.suppressionReasons,
      priority: entry.candidate.priority,
      displayRank: entry.displayRank,
      recommendedAction: entry.candidate.recommendedAction,
      generatedAt: entry.generatedAt
    };
  });

  return {
    entries: rows,
    summary: {
      total: rows.length,
      eligible,
      ineligible: rows.length - eligible,
      active: rows.length - suppressedByInteraction,
      suppressedByInteraction,
      bySourceType,
      byAction
    }
  };
}
