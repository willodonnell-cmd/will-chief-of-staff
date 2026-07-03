import {
  filterEligibleTodayCandidates,
  sortExecutiveItemCandidates,
  type ExecutiveItemRegistryEntry
} from "@/lib/executive-item-candidate-registry";

export const TODAY_EXECUTIVE_ITEM_CANDIDATE_LIMIT = 7;
export const TODAY_EXECUTIVE_ITEM_CANDIDATE_MAX_LIMIT = 10;

export function selectTodayExecutiveItemCandidates(
  entries: ExecutiveItemRegistryEntry[],
  limit = TODAY_EXECUTIVE_ITEM_CANDIDATE_LIMIT
): ExecutiveItemRegistryEntry[] {
  const safeLimit = Math.max(0, Math.min(limit, TODAY_EXECUTIVE_ITEM_CANDIDATE_MAX_LIMIT));

  return sortExecutiveItemCandidates(filterEligibleTodayCandidates(entries)).slice(0, safeLimit);
}
