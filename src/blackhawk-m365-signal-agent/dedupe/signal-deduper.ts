import type { ClassifiedSignalCandidate } from "../types";
import { buildSignalId } from "../utils/ids";

function canonicalScore(candidate: ClassifiedSignalCandidate) {
  let score = candidate.score;

  if (candidate.signalType === "meeting" && candidate.source === "calendar") {
    score += 30;
  }

  if (candidate.signalType === "decision" && candidate.source === "outlook") {
    score += 24;
  }

  if (candidate.source === "teams" && candidate.waitingOnWill && candidate.directAsk) {
    score += 20;
  }

  if (candidate.routingSurface === "investment_committee") {
    score += 12;
  }

  if (candidate.routingSurface === "suppress") {
    score -= 25;
  }

  return score;
}

function union(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function shouldMerge(left: ClassifiedSignalCandidate, right: ClassifiedSignalCandidate) {
  return left.dedupeKeys.some((key) => right.dedupeKeys.includes(key));
}

function mergePair(primary: ClassifiedSignalCandidate, secondary: ClassifiedSignalCandidate) {
  const mergedSourceRecordIds = union([
    ...primary.mergedSourceRecordIds,
    ...secondary.mergedSourceRecordIds,
    secondary.sourceRecordId
  ]);

  const participants = union([...primary.participants, ...secondary.participants]);
  const dueAt = [primary.dueAt, secondary.dueAt].filter(Boolean).sort()[0] ?? null;
  const sourceLabel = union([primary.sourceLabel, secondary.sourceLabel]).join(" + ");
  const summary = primary.summary.includes(secondary.summary)
    ? primary.summary
    : `${primary.summary} Related context also appears in ${secondary.sourceLabel.toLowerCase()}.`;
  const actionRequest = primary.actionRequest ?? secondary.actionRequest;
  const routingSurface =
    primary.routingSurface === "investment_committee" || secondary.routingSurface === "investment_committee"
      ? "investment_committee"
      : primary.routingSurface === "priority_inbox" || secondary.routingSurface === "priority_inbox"
        ? "priority_inbox"
        : "suppress";

  return {
    ...primary,
    id: buildSignalId(primary.source, primary.sourceRecordId, mergedSourceRecordIds),
    dueAt,
    participants,
    sourceLabel,
    summary,
    actionRequest,
    routingSurface,
    mergedSourceRecordIds,
    dedupeKeys: union([...primary.dedupeKeys, ...secondary.dedupeKeys])
  } satisfies ClassifiedSignalCandidate;
}

export function dedupeSignals(candidates: ClassifiedSignalCandidate[]) {
  const grouped: ClassifiedSignalCandidate[] = [];

  for (const candidate of candidates) {
    const matchIndex = grouped.findIndex((existing) => shouldMerge(existing, candidate));
    if (matchIndex === -1) {
      grouped.push(candidate);
      continue;
    }

    const existing = grouped[matchIndex];
    const [primary, secondary] =
      canonicalScore(existing) >= canonicalScore(candidate) ? [existing, candidate] : [candidate, existing];
    grouped[matchIndex] = mergePair(primary, secondary);
  }

  return grouped.sort((left, right) => canonicalScore(right) - canonicalScore(left));
}
