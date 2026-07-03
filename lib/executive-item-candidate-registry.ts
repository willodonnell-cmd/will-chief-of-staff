import {
  shouldNominateExecutiveItem,
  type ExecutiveItemCandidate
} from "@/lib/executive-item-nomination";

export const EXECUTIVE_ITEM_SOURCE_TYPES = [
  "investment_committee",
  "executive_brief",
  "meeting",
  "topic",
  "manual",
  "task",
  "unknown"
] as const;

export type ExecutiveItemSourceType = (typeof EXECUTIVE_ITEM_SOURCE_TYPES)[number];
export type ExecutiveItemFreshnessState = "new" | "updated" | "carry_forward";

export type ExecutiveItemRegistryEntry = {
  candidate: ExecutiveItemCandidate;
  sourceType: ExecutiveItemSourceType;
  sourceId: string;
  sourceLabel: string;
  generatedAt: string;
  eligibleForToday: boolean;
  eligibilityReason: string;
  displayRank: number;
  sortKey: string;
  freshness: ExecutiveItemFreshnessState;
};

export type ExecutiveItemRegistrySummary = {
  total: number;
  eligible: number;
  ineligible: number;
  bySourceType: Record<ExecutiveItemSourceType, number>;
  byEligibility: {
    eligible: number;
    ineligible: number;
  };
};

type RegisterExecutiveItemCandidatesInput = {
  candidates: ExecutiveItemCandidate[];
  sourceType: ExecutiveItemSourceType;
  sourceId: string;
  sourceLabel: string;
  generatedAt?: string;
  freshness?: ExecutiveItemFreshnessState;
  now?: Date;
};

const PRIORITY_SCORE: Record<ExecutiveItemCandidate["priority"], number> = {
  high: 300,
  medium: 200,
  low: 100
};

function urgencyScore(candidate: ExecutiveItemCandidate, now: Date) {
  if (!candidate.dueAt) {
    return 0;
  }

  const dueAt = Date.parse(candidate.dueAt);
  if (Number.isNaN(dueAt)) {
    return 0;
  }

  const hoursUntilDue = (dueAt - now.getTime()) / (60 * 60 * 1000);
  if (hoursUntilDue < 0) {
    return 80;
  }

  if (hoursUntilDue <= 24) {
    return 60;
  }

  if (hoursUntilDue <= 72) {
    return 30;
  }

  return 0;
}

function displayRankForCandidate(candidate: ExecutiveItemCandidate, now: Date) {
  return PRIORITY_SCORE[candidate.priority] + urgencyScore(candidate, now) + candidate.attentionReasons.length;
}

function buildEligibilityReason(candidate: ExecutiveItemCandidate) {
  if (candidate.suppressionReasons.length > 0) {
    return `Suppressed: ${candidate.suppressionReasons.join(", ")}`;
  }

  if (candidate.attentionReasons.length === 0) {
    return "No attention reason";
  }

  return "Eligible attention claim";
}

function buildSortKey(entry: Omit<ExecutiveItemRegistryEntry, "sortKey">) {
  return [
    String(9999 - entry.displayRank).padStart(4, "0"),
    entry.candidate.dueAt ?? "9999-12-31T23:59:59.999Z",
    entry.sourceType,
    entry.sourceId,
    entry.candidate.id
  ].join("|");
}

export function registerExecutiveItemCandidates(input: RegisterExecutiveItemCandidatesInput): ExecutiveItemRegistryEntry[] {
  const now = input.now ?? new Date();
  const generatedAt = input.generatedAt ?? now.toISOString();

  return input.candidates.map((candidate) => {
    const eligibleForToday = shouldNominateExecutiveItem(candidate);
    const entryWithoutSortKey: Omit<ExecutiveItemRegistryEntry, "sortKey"> = {
      candidate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceLabel: input.sourceLabel,
      generatedAt,
      eligibleForToday,
      eligibilityReason: buildEligibilityReason(candidate),
      displayRank: displayRankForCandidate(candidate, now),
      freshness: input.freshness ?? "new"
    };

    return {
      ...entryWithoutSortKey,
      sortKey: buildSortKey(entryWithoutSortKey)
    };
  });
}

export function filterEligibleTodayCandidates(entries: ExecutiveItemRegistryEntry[]) {
  return entries.filter((entry) => entry.eligibleForToday);
}

export function sortExecutiveItemCandidates(entries: ExecutiveItemRegistryEntry[]) {
  return [...entries].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function summarizeExecutiveItemCandidates(entries: ExecutiveItemRegistryEntry[]): ExecutiveItemRegistrySummary {
  const bySourceType = Object.fromEntries(
    EXECUTIVE_ITEM_SOURCE_TYPES.map((sourceType) => [sourceType, 0])
  ) as Record<ExecutiveItemSourceType, number>;

  for (const entry of entries) {
    bySourceType[entry.sourceType] += 1;
  }

  const eligible = entries.filter((entry) => entry.eligibleForToday).length;

  return {
    total: entries.length,
    eligible,
    ineligible: entries.length - eligible,
    bySourceType,
    byEligibility: {
      eligible,
      ineligible: entries.length - eligible
    }
  };
}
