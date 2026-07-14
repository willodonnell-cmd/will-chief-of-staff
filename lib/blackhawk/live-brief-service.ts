import "server-only";

import {
  getBlackhawkBriefRefresh,
  getCurrentBlackhawkLiveBrief,
  requestBlackhawkBriefRefresh
} from "@/lib/blackhawk/live-brief-repository";
import { buildBlackhawkRefreshIdempotencyKey } from "@/lib/blackhawk/live-brief-refresh-key";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

export class BlackhawkAuthenticationError extends Error {}

async function requireCurrentBlackhawkUser() {
  const resolved = await resolveCurrentAppUser();
  if (!resolved || (process.env.NODE_ENV === "production" && resolved.source === "bootstrap")) {
    throw new BlackhawkAuthenticationError("Blackhawk requires Will's authenticated account.");
  }
  return resolved;
}

export async function getBlackhawkOpeningState() {
  const resolved = await requireCurrentBlackhawkUser();
  const current = await getCurrentBlackhawkLiveBrief({
    client: resolved.client,
    userId: resolved.user.id
  });

  return {
    current,
    user: {
      id: resolved.user.id,
      fullName: resolved.user.full_name,
      timezone: resolved.user.timezone
    }
  };
}

export async function requestBlackhawkOpeningRefresh(params: { now?: string | Date } = {}) {
  const resolved = await requireCurrentBlackhawkUser();
  return await requestBlackhawkBriefRefresh({
    client: resolved.client,
    userId: resolved.user.id,
    trigger: "open",
    idempotencyKey: buildBlackhawkRefreshIdempotencyKey({
      userId: resolved.user.id,
      trigger: "open",
      now: params.now
    })
  });
}

export async function getCurrentUserBlackhawkRefresh(refreshId: string) {
  const resolved = await requireCurrentBlackhawkUser();
  return await getBlackhawkBriefRefresh({
    client: resolved.client,
    userId: resolved.user.id,
    refreshId
  });
}
