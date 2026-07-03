import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EXECUTIVE_ITEM_SOURCE_TYPES,
  type ExecutiveItemRegistryEntry,
  type ExecutiveItemSourceType
} from "@/lib/executive-item-candidate-registry";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export const CANDIDATE_INTERACTION_ACTIONS = ["dismissed", "snoozed", "reviewed"] as const;
export type CandidateInteractionAction = (typeof CANDIDATE_INTERACTION_ACTIONS)[number];

export type ExecutiveItemCandidateInteraction = {
  id: string;
  userId: string;
  candidateId: string;
  interactionKey: string;
  sourceType: ExecutiveItemSourceType;
  sourceId: string;
  action: CandidateInteractionAction;
  snoozedUntil: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecordExecutiveItemCandidateInteractionInput = {
  userId: string;
  candidateId: string;
  interactionKey: string;
  sourceType: ExecutiveItemSourceType;
  sourceId: string;
  action: CandidateInteractionAction;
  snoozedUntil?: string | null;
  reason?: string | null;
};

export type CandidateInteractionValidationResult =
  | { ok: true; input: RecordExecutiveItemCandidateInteractionInput }
  | { ok: false; error: "invalid-action" | "invalid-source-type" | "missing-candidate-identity" | "invalid-snooze" };

type InteractionRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  interaction_key: string;
  source_type: string;
  source_id: string;
  action: CandidateInteractionAction;
  snoozed_until: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutiveItemCandidateInteractionsRepository = {
  listForUser(input: { userId: string }): Promise<ExecutiveItemCandidateInteraction[]>;
  record(input: RecordExecutiveItemCandidateInteractionInput): Promise<ExecutiveItemCandidateInteraction>;
};

function compactText(value: string | null | undefined) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeKeyPart(value: string | null | undefined) {
  return compactText(value).toLowerCase();
}

function isCandidateInteractionAction(value: string): value is CandidateInteractionAction {
  return CANDIDATE_INTERACTION_ACTIONS.includes(value as CandidateInteractionAction);
}

function isExecutiveItemSourceType(value: string): value is ExecutiveItemSourceType {
  return EXECUTIVE_ITEM_SOURCE_TYPES.includes(value as ExecutiveItemSourceType);
}

function mapInteractionRow(row: InteractionRow): ExecutiveItemCandidateInteraction {
  return {
    id: row.id,
    userId: row.user_id,
    candidateId: row.candidate_id,
    interactionKey: row.interaction_key,
    sourceType: isExecutiveItemSourceType(row.source_type) ? row.source_type : "unknown",
    sourceId: row.source_id,
    action: row.action,
    snoozedUntil: row.snoozed_until,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function buildCandidateInteractionKey(entry: ExecutiveItemRegistryEntry) {
  const candidate = entry.candidate;
  return [
    entry.sourceType,
    normalizeKeyPart(entry.sourceId),
    normalizeKeyPart(candidate.id),
    normalizeKeyPart(candidate.title),
    [...candidate.attentionReasons].sort().join(","),
    normalizeKeyPart(candidate.dueAt)
  ].join("|");
}

export function isCandidateSnoozed(interaction: ExecutiveItemCandidateInteraction, now = new Date()) {
  if (interaction.action !== "snoozed" || !interaction.snoozedUntil) {
    return false;
  }

  const snoozedUntil = Date.parse(interaction.snoozedUntil);
  return !Number.isNaN(snoozedUntil) && snoozedUntil > now.getTime();
}

export function isCandidateReviewed(interaction: ExecutiveItemCandidateInteraction) {
  return interaction.action === "reviewed";
}

export function isCandidateSuppressedByInteraction(
  entry: ExecutiveItemRegistryEntry,
  interactions: ExecutiveItemCandidateInteraction[],
  now = new Date()
) {
  const interactionKey = buildCandidateInteractionKey(entry);
  return interactions.some((interaction) => {
    if (interaction.interactionKey !== interactionKey) {
      return false;
    }

    if (interaction.action === "dismissed") {
      return true;
    }

    if (isCandidateReviewed(interaction)) {
      return true;
    }

    return isCandidateSnoozed(interaction, now);
  });
}

export function applyCandidateInteractions(
  entries: ExecutiveItemRegistryEntry[],
  interactions: ExecutiveItemCandidateInteraction[],
  now = new Date()
) {
  return entries.filter((entry) => !isCandidateSuppressedByInteraction(entry, interactions, now));
}

export function validateCandidateInteractionActionInput(
  input: RecordExecutiveItemCandidateInteractionInput,
  now = new Date()
): CandidateInteractionValidationResult {
  if (!isCandidateInteractionAction(input.action)) {
    return { ok: false, error: "invalid-action" };
  }

  if (!isExecutiveItemSourceType(input.sourceType)) {
    return { ok: false, error: "invalid-source-type" };
  }

  if (
    !compactText(input.userId) ||
    !compactText(input.candidateId) ||
    !compactText(input.interactionKey) ||
    !compactText(input.sourceId)
  ) {
    return { ok: false, error: "missing-candidate-identity" };
  }

  if (input.action === "snoozed") {
    const snoozedUntil = Date.parse(input.snoozedUntil ?? "");
    if (Number.isNaN(snoozedUntil) || snoozedUntil <= now.getTime()) {
      return { ok: false, error: "invalid-snooze" };
    }
  }

  return {
    ok: true,
    input: {
      ...input,
      userId: compactText(input.userId),
      candidateId: compactText(input.candidateId),
      interactionKey: compactText(input.interactionKey),
      sourceId: compactText(input.sourceId),
      snoozedUntil: input.action === "snoozed" ? input.snoozedUntil ?? null : null,
      reason: compactText(input.reason) || null
    }
  };
}

export function createSupabaseExecutiveItemCandidateInteractionsRepository(
  client: SupabaseClient
): ExecutiveItemCandidateInteractionsRepository {
  return {
    async listForUser(input) {
      const response = await withSupabaseTimeout(
        client
          .from("executive_item_candidate_interactions")
          .select(
            "id, user_id, candidate_id, interaction_key, source_type, source_id, action, snoozed_until, reason, created_at, updated_at"
          )
          .eq("user_id", input.userId)
          .returns<InteractionRow[]>()
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data ?? []).map(mapInteractionRow);
    },
    async record(input) {
      const validation = validateCandidateInteractionActionInput(input);
      if (!validation.ok) {
        throw new Error(validation.error);
      }

      const row = {
        user_id: validation.input.userId,
        candidate_id: validation.input.candidateId,
        interaction_key: validation.input.interactionKey,
        source_type: validation.input.sourceType,
        source_id: validation.input.sourceId,
        action: validation.input.action,
        snoozed_until: validation.input.snoozedUntil,
        reason: validation.input.reason
      };

      const response = await withSupabaseTimeout(
        client
          .from("executive_item_candidate_interactions")
          .upsert(row, { onConflict: "user_id,interaction_key" })
          .select(
            "id, user_id, candidate_id, interaction_key, source_type, source_id, action, snoozed_until, reason, created_at, updated_at"
          )
          .single<InteractionRow>()
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? "Executive Item candidate interaction could not be recorded.");
      }

      return mapInteractionRow(response.data);
    }
  };
}
