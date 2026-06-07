import type { RoutingSurface } from "../payload/schemas";
import type { SignalCandidate } from "../types";

const INVESTMENT_COMMITTEE_KEYWORDS = [
  "investment committee",
  "venture investment",
  "deal review",
  "investment memo",
  "investment approval",
  "portfolio company",
  "ic prep",
  "investment review",
  "funding memo"
] as const;

export function classifyRoutingSurface(candidate: SignalCandidate, score: number): {
  surface: RoutingSurface;
  reason: string;
} {
  const normalized = candidate.rawText.toLowerCase();
  const matchedInvestmentCues = INVESTMENT_COMMITTEE_KEYWORDS.filter((keyword) =>
    normalized.includes(keyword)
  );

  if (candidate.preferredSurface === "investment_committee" || matchedInvestmentCues.length > 0) {
    return {
      surface: "investment_committee",
      reason:
        matchedInvestmentCues.length > 0
          ? `Routed to Investment Committee because it references ${matchedInvestmentCues.join(", ")}.`
          : "Routed to Investment Committee by classifier policy."
    };
  }

  if (candidate.preferredSurface === "suppress" || score < 35 || candidate.likelyResolved) {
    return {
      surface: "suppress",
      reason: candidate.likelyResolved
        ? "Suppressed because the issue appears resolved already."
        : "Suppressed because it did not clear the relevance threshold."
    };
  }

  return {
    surface: "priority_inbox",
    reason: "Routed to Priority Inbox because Will appears accountable for a consequential next step."
  };
}
