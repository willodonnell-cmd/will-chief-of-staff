import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type BlackhawkLiveBrief,
  validateBlackhawkLiveBrief
} from "@/lib/blackhawk/live-brief-contract";

type LiveBriefStateRow = {
  user_id: string;
  brief_id: string;
  contract_version: string;
  brief: BlackhawkLiveBrief;
  generated_at: string;
  promoted_from_refresh_id: string;
  revision: number;
  promoted_at: string;
  updated_at: string;
};

type LiveBriefRefreshRow = {
  id: string;
  user_id: string;
  trigger: "open" | "scheduled" | "manual";
  status: "requested" | "running" | "succeeded" | "partial" | "failed";
  idempotency_key: string;
  started_at: string;
  completed_at: string | null;
  source_coverage: Record<string, unknown>;
  validation_errors: string[];
  error_message: string | null;
};

export type BlackhawkBriefRefresh = {
  id: string;
  trigger: LiveBriefRefreshRow["trigger"];
  status: LiveBriefRefreshRow["status"];
  idempotencyKey: string;
  startedAt: string;
  completedAt: string | null;
  sourceCoverage: Record<string, unknown>;
  validationErrors: string[];
  errorMessage: string | null;
};

export type CurrentLiveBrief = {
  brief: BlackhawkLiveBrief;
  revision: number;
  promotedAt: string;
};

function assertNoSupabaseError(error: { message?: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

function mapRefreshRow(row: LiveBriefRefreshRow): BlackhawkBriefRefresh {
  return {
    id: row.id,
    trigger: row.trigger,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    sourceCoverage: row.source_coverage,
    validationErrors: row.validation_errors,
    errorMessage: row.error_message
  };
}

export async function getCurrentBlackhawkLiveBrief(params: {
  client: SupabaseClient;
  userId: string;
}): Promise<CurrentLiveBrief | null> {
  const response = await params.client
    .from("blackhawk_live_brief_state")
    .select("brief, revision, promoted_at")
    .eq("user_id", params.userId)
    .maybeSingle<Pick<LiveBriefStateRow, "brief" | "revision" | "promoted_at">>();

  assertNoSupabaseError(response.error, "The current Blackhawk brief could not be loaded.");
  if (!response.data) {
    return null;
  }

  const validation = validateBlackhawkLiveBrief(response.data.brief);
  if (!validation.ok) {
    throw new Error(`The stored Blackhawk brief is invalid: ${validation.errors.join(" ")}`);
  }

  return {
    brief: response.data.brief,
    revision: response.data.revision,
    promotedAt: response.data.promoted_at
  };
}

export async function requestBlackhawkBriefRefresh(params: {
  client: SupabaseClient;
  userId: string;
  trigger: LiveBriefRefreshRow["trigger"];
  idempotencyKey: string;
}) {
  const response = await params.client
    .from("blackhawk_live_brief_refreshes")
    .upsert({
      user_id: params.userId,
      trigger: params.trigger,
      idempotency_key: params.idempotencyKey,
      status: "requested"
    }, {
      onConflict: "user_id,idempotency_key",
      ignoreDuplicates: true
    })
    .select("id, user_id, trigger, status, idempotency_key, started_at, completed_at, source_coverage, validation_errors, error_message")
    .single<LiveBriefRefreshRow>();

  if (response.error) {
    const existing = await params.client
      .from("blackhawk_live_brief_refreshes")
      .select("id, user_id, trigger, status, idempotency_key, started_at, completed_at, source_coverage, validation_errors, error_message")
      .eq("user_id", params.userId)
      .eq("idempotency_key", params.idempotencyKey)
      .single<LiveBriefRefreshRow>();
    assertNoSupabaseError(existing.error, "The Blackhawk refresh could not be requested.");
    return mapRefreshRow(existing.data);
  }

  return mapRefreshRow(response.data);
}

export async function getBlackhawkBriefRefresh(params: {
  client: SupabaseClient;
  userId: string;
  refreshId: string;
}): Promise<BlackhawkBriefRefresh | null> {
  const response = await params.client
    .from("blackhawk_live_brief_refreshes")
    .select("id, user_id, trigger, status, idempotency_key, started_at, completed_at, source_coverage, validation_errors, error_message")
    .eq("id", params.refreshId)
    .eq("user_id", params.userId)
    .maybeSingle<LiveBriefRefreshRow>();

  assertNoSupabaseError(response.error, "The Blackhawk refresh could not be loaded.");
  return response.data ? mapRefreshRow(response.data) : null;
}

export async function promoteBlackhawkLiveBrief(params: {
  client: SupabaseClient;
  refreshId: string;
  brief: BlackhawkLiveBrief;
  now?: string | Date;
  maximumAgeMinutes?: number;
}): Promise<CurrentLiveBrief> {
  const validation = validateBlackhawkLiveBrief(params.brief, {
    now: params.now,
    maximumAgeMinutes: params.maximumAgeMinutes
  });
  if (!validation.ok) {
    throw new Error(`Blackhawk refused to replace the current brief: ${validation.errors.join(" ")}`);
  }

  const response = await params.client.rpc("promote_blackhawk_live_brief", {
    p_refresh_id: params.refreshId,
    p_brief: params.brief
  }).single<LiveBriefStateRow>();

  assertNoSupabaseError(response.error, "The Blackhawk brief could not be promoted.");

  return {
    brief: response.data.brief,
    revision: response.data.revision,
    promotedAt: response.data.promoted_at
  };
}

export async function failBlackhawkBriefRefresh(params: {
  client: SupabaseClient;
  userId: string;
  refreshId: string;
  errorMessage: string;
  validationErrors?: string[];
}) {
  const response = await params.client
    .from("blackhawk_live_brief_refreshes")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: params.errorMessage,
      validation_errors: params.validationErrors ?? []
    })
    .eq("id", params.refreshId)
    .eq("user_id", params.userId);

  assertNoSupabaseError(response.error, "The failed Blackhawk refresh could not be recorded.");
}
