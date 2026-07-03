"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CANDIDATE_INTERACTION_ACTIONS,
  createSupabaseExecutiveItemCandidateInteractionsRepository,
  validateCandidateInteractionActionInput,
  type CandidateInteractionAction
} from "@/lib/executive-item-candidate-interactions";
import {
  EXECUTIVE_ITEM_SOURCE_TYPES,
  type ExecutiveItemSourceType
} from "@/lib/executive-item-candidate-registry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseAction(value: string): CandidateInteractionAction | null {
  return CANDIDATE_INTERACTION_ACTIONS.includes(value as CandidateInteractionAction)
    ? (value as CandidateInteractionAction)
    : null;
}

function parseSourceType(value: string): ExecutiveItemSourceType | null {
  return EXECUTIVE_ITEM_SOURCE_TYPES.includes(value as ExecutiveItemSourceType) ? (value as ExecutiveItemSourceType) : null;
}

function resolveSnoozedUntil(preset: string, now = new Date()) {
  const next = new Date(now);

  if (preset === "later_today") {
    next.setHours(next.getHours() + 4, 0, 0, 0);
    return next.toISOString();
  }

  if (preset === "tomorrow") {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return next.toISOString();
  }

  if (preset === "next_week") {
    next.setDate(next.getDate() + 7);
    next.setHours(9, 0, 0, 0);
    return next.toISOString();
  }

  return null;
}

function redirectHomeWithStatus(kind: "notice" | "error", value: string): never {
  const encoded = encodeURIComponent(value);
  if (kind === "notice") {
    redirect(`/?notice=${encoded}` as `/?notice=${string}`);
  }
  redirect(`/?error=${encoded}` as `/?error=${string}`);
}

export async function recordExecutiveItemCandidateInteractionAction(formData: FormData) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirectHomeWithStatus("error", "no-active-user");
  }

  const action = parseAction(formString(formData, "action"));
  const sourceType = parseSourceType(formString(formData, "sourceType"));
  const snoozedUntil = action === "snoozed" ? resolveSnoozedUntil(formString(formData, "snoozePreset")) : null;

  if (!action || !sourceType) {
    redirectHomeWithStatus("error", "invalid-candidate-action");
  }

  const validation = validateCandidateInteractionActionInput({
    userId: resolved.user.id,
    candidateId: formString(formData, "candidateId"),
    interactionKey: formString(formData, "interactionKey"),
    sourceType,
    sourceId: formString(formData, "sourceId"),
    action,
    snoozedUntil,
    reason: formString(formData, "reason") || null
  });

  if (!validation.ok) {
    redirectHomeWithStatus("error", validation.error);
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const repository = createSupabaseExecutiveItemCandidateInteractionsRepository(client);

  try {
    await repository.record(validation.input);
  } catch (error) {
    console.error("[executive-item-candidates] Failed to record candidate interaction.", error);
    redirectHomeWithStatus("error", "candidate-interaction-storage");
  }

  revalidatePath("/");
  revalidatePath("/admin/executive-item-candidates");

  redirectHomeWithStatus("notice", `candidate-${action}`);
}
