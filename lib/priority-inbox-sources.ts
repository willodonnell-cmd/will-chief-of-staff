import {
  createOutlookAuthorizationUrl,
  decryptOutlookSecret,
  encryptOutlookSecret,
  exchangeOutlookCodeForTokens,
  fetchOutlookProfile,
  getOutlookConnectHref,
  isOutlookConfigured,
  listOutlookInboxMessages,
  refreshOutlookAccessToken,
  resolveOutlookRedirectUri,
  type OutlookMessage,
  type OutlookProfile,
  type OutlookTokenSet
} from "@/lib/outlook";
import {
  ensureSeedPriorityInboxItems,
  getPriorityInboxContext,
  upsertPriorityInboxSourceCandidates,
  type PriorityInboxContext
} from "@/lib/priority-inbox-store";
import {
  formatPriorityInboxRelativeTime,
  type PriorityInboxSourceCandidate,
  type PriorityInboxSourceConnectionSummary,
  type PriorityInboxSourceStatus
} from "@/lib/priority-inbox";
import { normalizePriorityInboxSourceError } from "@/lib/priority-inbox-errors";
import type { PriorityInboxForwardingSummary } from "@/lib/priority-inbox-forwarding";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

type SourceConnectionRow = {
  id: string;
  user_id: string;
  source: "outlook" | "gmail" | "teams";
  connection_status: "disconnected" | "connected" | "needs_reauth" | "error";
  external_account_id: string | null;
  external_account_email: string | null;
  external_account_label: string | null;
  delegated_scopes: string[] | null;
  token_access_ciphertext: string | null;
  token_refresh_ciphertext: string | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  last_sync_started_at: string | null;
  last_sync_status: "idle" | "success" | "error";
  last_sync_error: string | null;
  source_metadata: unknown;
};

type AdapterConnectionContext = Extract<PriorityInboxContext, { resolved: { user: { id: string } } }>;

type AdapterConnectionSummary = {
  summary: PriorityInboxSourceConnectionSummary;
  row: SourceConnectionRow | null;
};

type PriorityInboxSourceAdapter = {
  source: "outlook";
  getConnectionSummary: (context: AdapterConnectionContext) => Promise<AdapterConnectionSummary>;
  sync: (context: AdapterConnectionContext, row: SourceConnectionRow) => Promise<number>;
};

const PRIORITY_INBOX_SOURCE_CONNECTION_SELECT = `
  id,
  user_id,
  source,
  connection_status,
  external_account_id,
  external_account_email,
  external_account_label,
  delegated_scopes,
  token_access_ciphertext,
  token_refresh_ciphertext,
  token_expires_at,
  last_synced_at,
  last_sync_started_at,
  last_sync_status,
  last_sync_error,
  source_metadata
`;

const OUTLOOK_AUTO_SYNC_STALE_MS = 15 * 60 * 1000;
const OUTLOOK_MESSAGE_SCAN_LIMIT = 25;
const OUTLOOK_CANDIDATE_LIMIT = 12;

function outlookConnectionStatusLabel(row: SourceConnectionRow | null) {
  if (!isOutlookConfigured()) {
    return "Outlook integration is not configured yet.";
  }

  if (!row) {
    return "Outlook is not connected.";
  }

  if (row.connection_status === "needs_reauth") {
    return "Outlook needs to be reconnected.";
  }

  if (row.connection_status === "error") {
    return row.last_sync_error ? `Outlook sync needs attention: ${row.last_sync_error}` : "Outlook sync needs attention.";
  }

  if (row.last_synced_at) {
    return `Outlook synced ${formatPriorityInboxRelativeTime(row.last_synced_at)}.`;
  }

  return "Outlook connected. Sync when you are ready.";
}

function toConnectionSummary(row: SourceConnectionRow | null): PriorityInboxSourceConnectionSummary {
  if (!isOutlookConfigured()) {
    return {
      source: "outlook",
      label: "Outlook",
      state: "not_configured",
      connectHref: getOutlookConnectHref(),
      canSync: false,
      statusLabel: "Outlook integration is missing Microsoft client or encryption configuration."
    };
  }

  return {
    source: "outlook",
    label: "Outlook",
    state: row?.connection_status ?? "disconnected",
    connectHref: getOutlookConnectHref(),
    canSync: row?.connection_status === "connected",
    accountLabel: row?.external_account_email ?? row?.external_account_label ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastSyncError: row?.last_sync_error ?? null,
    statusLabel: outlookConnectionStatusLabel(row)
  };
}

function toConnectionSummaryFromError(error: unknown): PriorityInboxSourceConnectionSummary {
  const message = normalizePriorityInboxSourceError(error, "Outlook connection status could not be loaded.");
  return {
    source: "outlook",
    label: "Outlook",
    state: "error",
    connectHref: getOutlookConnectHref(),
    canSync: false,
    lastSyncError: message,
    statusLabel: message
  };
}

async function getSourceConnectionRow(context: AdapterConnectionContext, source: SourceConnectionRow["source"]) {
  const response = await withSupabaseTimeout(
    context.client
      .from("priority_inbox_source_connections")
      .select(PRIORITY_INBOX_SOURCE_CONNECTION_SELECT)
      .eq("user_id", context.resolved.user.id)
      .eq("source", source)
      .maybeSingle<SourceConnectionRow>()
  );

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? null;
}

async function updateSourceConnection(
  context: AdapterConnectionContext,
  source: SourceConnectionRow["source"],
  values: Record<string, unknown>
) {
  const response = await withSupabaseTimeout(
    context.client
      .from("priority_inbox_source_connections")
      .upsert(
        {
          user_id: context.resolved.user.id,
          source,
          ...values
        },
        {
          onConflict: "user_id,source"
        }
      )
      .select(PRIORITY_INBOX_SOURCE_CONNECTION_SELECT)
      .single<SourceConnectionRow>()
  );

  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? "Priority Inbox source connection could not be saved.");
  }

  return response.data;
}

async function ensureOutlookAccessToken(context: AdapterConnectionContext, row: SourceConnectionRow) {
  if (!row.token_access_ciphertext) {
    throw new Error("Outlook is connected, but no access token is stored.");
  }

  const refreshToken = row.token_refresh_ciphertext ? decryptOutlookSecret(row.token_refresh_ciphertext) : null;
  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : Number.NaN;
  const shouldRefresh = !Number.isFinite(expiresAt) || expiresAt - Date.now() < 5 * 60 * 1000;

  if (!shouldRefresh) {
    return {
      accessToken: decryptOutlookSecret(row.token_access_ciphertext),
      row
    };
  }

  if (!refreshToken) {
    throw new Error("Outlook refresh token is unavailable. Reconnect Outlook to continue.");
  }

  const refreshedTokens = await refreshOutlookAccessToken({ refreshToken });
  const nextRow = await updateSourceConnection(context, "outlook", {
    connection_status: "connected",
    token_access_ciphertext: encryptOutlookSecret(refreshedTokens.accessToken),
    token_refresh_ciphertext: refreshedTokens.refreshToken
      ? encryptOutlookSecret(refreshedTokens.refreshToken)
      : row.token_refresh_ciphertext,
    token_expires_at: refreshedTokens.expiresAt,
    delegated_scopes: refreshedTokens.scopes,
    last_sync_error: null
  });

  return {
    accessToken: refreshedTokens.accessToken,
    row: nextRow
  };
}

function coalesceSenderName(message: OutlookMessage) {
  return message.from?.emailAddress?.name?.trim() || message.from?.emailAddress?.address?.trim() || "Unknown sender";
}

function normalizeSnippet(message: OutlookMessage) {
  return (message.bodyPreview ?? "").replace(/\s+/g, " ").trim();
}

function scoreOutlookMessage(message: OutlookMessage) {
  let score = 0;

  if (message.isRead === false) {
    score += 2;
  }

  if (message.importance === "high") {
    score += 3;
  }

  if (message.flag?.flagStatus === "flagged") {
    score += 2;
  }

  if (message.inferenceClassification === "focused") {
    score += 1;
  }

  if (message.hasAttachments) {
    score += 1;
  }

  const receivedAt = message.receivedDateTime ? Date.parse(message.receivedDateTime) : Number.NaN;
  if (Number.isFinite(receivedAt)) {
    const ageHours = Math.max(0, (Date.now() - receivedAt) / 3_600_000);
    if (ageHours <= 6) {
      score += 2;
    } else if (ageHours <= 24) {
      score += 1;
    }
  }

  return score;
}

function buildOutlookSignals(message: OutlookMessage) {
  const signals: string[] = [];

  if (message.isRead === false) {
    signals.push("Unread");
  }

  if (message.importance === "high") {
    signals.push("High importance");
  }

  if (message.flag?.flagStatus === "flagged") {
    signals.push("Flagged in Outlook");
  }

  if (message.inferenceClassification === "focused") {
    signals.push("Focused Inbox classification");
  }

  if (message.hasAttachments) {
    signals.push("Includes attachment");
  }

  if (signals.length === 0) {
    signals.push("Recent Outlook message");
  }

  return signals;
}

function buildOutlookCandidate(message: OutlookMessage): PriorityInboxSourceCandidate | null {
  const subject = (message.subject ?? "").trim() || "Untitled Outlook thread";
  const snippet = normalizeSnippet(message);
  const receivedAt = message.receivedDateTime?.trim();
  const webLink = message.webLink?.trim();

  if (!message.id || !receivedAt || !webLink) {
    return null;
  }

  const signals = buildOutlookSignals(message);
  const score = scoreOutlookMessage(message);
  const sender = coalesceSenderName(message);
  const highPriority = score >= 5;
  const recommendedAction =
    message.importance === "high" || message.flag?.flagStatus === "flagged"
      ? "create_task"
      : message.isRead === false && message.inferenceClassification === "focused"
        ? "add_commitment"
        : message.hasAttachments
          ? "save_reference"
          : "defer";

  return {
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: webLink,
    externalMessageId: message.id,
    conversationId: message.conversationId ?? null,
    receivedAt,
    sender,
    senderRole: message.from?.emailAddress?.address ?? null,
    subject,
    primaryLine: `Review "${subject}" from ${sender}.`,
    snippet: snippet || "Open in Outlook to review the message body.",
    visibleState: highPriority ? "high_priority" : "needs_review",
    whySurfaced: `${signals[0]} from Outlook.`,
    supportingSignals: signals,
    recommendedAction,
    dispositionReason: message.isRead === false ? "reply_needed" : "business_context",
    updatedCue:
      message.flag?.flagStatus === "flagged"
        ? "Flagged"
        : message.importance === "high"
          ? "High importance"
          : message.isRead === false
            ? "Unread"
            : null,
    attachmentCue: message.hasAttachments ? "Includes attachment" : null,
    groupedCue: message.conversationId ? "Threaded conversation" : null,
    taskPrefill: {
      description: `Review Outlook thread: ${subject}`,
      nextStep: snippet || `Review the Outlook thread from ${sender}.`,
      desiredOutcome: "Decide the operational next move from this thread.",
      priority: highPriority ? "high" : "medium",
      categoryName: "Person",
      associatedWith: `${sender} · Outlook`
    },
    commitmentPrefill: {
      statement: `Close the loop on "${subject}".`,
      owedTo: sender,
      dueLabel: highPriority ? "Today" : "Soon",
      contextNote: snippet || `Review the Outlook thread from ${sender}.`,
      associatedWith: `${sender} · Outlook`
    },
    initiativePrefill: {
      name: subject,
      contextNote: snippet || `Created from Outlook thread with ${sender}.`,
      associatedWith: `${sender} · Outlook`
    },
    referencePrefill: {
      title: subject,
      summary: snippet || `Saved from Outlook thread with ${sender}.`
    },
    sourceMetadata: {
      internetMessageId: message.internetMessageId ?? null,
      importance: message.importance ?? "normal",
      inferenceClassification: message.inferenceClassification ?? null,
      isRead: message.isRead ?? null,
      hasAttachments: message.hasAttachments ?? false,
      lastModifiedDateTime: message.lastModifiedDateTime ?? null
    }
  };
}

function selectOutlookCandidates(messages: OutlookMessage[]) {
  const newestByConversation = new Map<string, OutlookMessage>();
  const conversationless: OutlookMessage[] = [];

  for (const message of messages) {
    if (message.conversationId) {
      const existing = newestByConversation.get(message.conversationId);
      const nextTimestamp = Date.parse(message.receivedDateTime ?? "");
      const existingTimestamp = Date.parse(existing?.receivedDateTime ?? "");

      if (!existing || Number.isNaN(existingTimestamp) || nextTimestamp > existingTimestamp) {
        newestByConversation.set(message.conversationId, message);
      }
      continue;
    }

    conversationless.push(message);
  }

  return [...newestByConversation.values(), ...conversationless]
    .map((message) => ({
      message,
      score: scoreOutlookMessage(message)
    }))
    .filter(({ message, score }) => {
      const receivedAt = Date.parse(message.receivedDateTime ?? "");
      const ageDays = Number.isFinite(receivedAt) ? (Date.now() - receivedAt) / 86_400_000 : Number.POSITIVE_INFINITY;
      return Boolean(message.webLink) && (score >= 2 || ageDays <= 3);
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return Date.parse(right.message.receivedDateTime ?? "") - Date.parse(left.message.receivedDateTime ?? "");
    })
    .slice(0, OUTLOOK_CANDIDATE_LIMIT)
    .map(({ message }) => buildOutlookCandidate(message))
    .filter((candidate): candidate is PriorityInboxSourceCandidate => Boolean(candidate));
}

async function syncOutlook(context: AdapterConnectionContext, row: SourceConnectionRow) {
  const { accessToken } = await ensureOutlookAccessToken(context, row);
  const messages = await listOutlookInboxMessages(accessToken, OUTLOOK_MESSAGE_SCAN_LIMIT);
  const candidates = selectOutlookCandidates(messages);
  await upsertPriorityInboxSourceCandidates({
    context,
    candidates
  });

  return candidates.length;
}

const outlookAdapter: PriorityInboxSourceAdapter = {
  source: "outlook",
  async getConnectionSummary(context) {
    try {
      const row = await getSourceConnectionRow(context, "outlook");
      return {
        summary: toConnectionSummary(row),
        row
      };
    } catch (error) {
      return {
        summary: toConnectionSummaryFromError(error),
        row: null
      };
    }
  },
  async sync(context, row) {
    return await syncOutlook(context, row);
  }
};

const priorityInboxSourceAdapters: Record<string, PriorityInboxSourceAdapter> = {
  outlook: outlookAdapter
};

export function buildPriorityInboxSourceStatuses(params: {
  outlook: PriorityInboxSourceConnectionSummary;
  forwarding: PriorityInboxForwardingSummary | null;
}): PriorityInboxSourceStatus[] {
  const statuses: PriorityInboxSourceStatus[] = [{ id: "manual", label: "Manual captures available", kind: "healthy" }];

  if (params.forwarding?.destinationAddress) {
    statuses.push({
      id: "forwarded-email",
      label:
        params.forwarding.providerStatus === "ready"
          ? `Forward to Blackhawk: ${params.forwarding.destinationAddress}`
          : `Forwarding destination saved: ${params.forwarding.destinationAddress}`,
      kind: params.forwarding.providerStatus === "ready" ? "healthy" : "warning"
    });
  } else {
    statuses.push({
      id: "forwarded-email-warning",
      label: "Forward-to-Blackhawk destination is not configured yet.",
      kind: "warning"
    });
  }

  if (params.outlook.state === "connected") {
    statuses.push({
      id: "outlook",
      label: params.outlook.accountLabel ? `Outlook connected: ${params.outlook.accountLabel}` : "Outlook connected",
      kind: "healthy"
    });
  } else {
    statuses.push({
      id: "outlook-warning",
      label: params.outlook.statusLabel,
      kind: "warning"
    });
  }

  statuses.push({
    id: "future-adapters",
    label: "Gmail and Teams adapters remain future work in this pass.",
    kind: "warning"
  });

  return statuses;
}

export async function getPriorityInboxSourceConnectionSummary(source: "outlook") {
  const context = await getPriorityInboxContext();
  if (!context || "error" in context) {
    return toConnectionSummary(null);
  }

  return (await priorityInboxSourceAdapters[source].getConnectionSummary(context)).summary;
}

export async function shouldAutoSyncPriorityInboxSource(source: "outlook") {
  const context = await getPriorityInboxContext();
  if (!context || "error" in context) {
    return false;
  }

  const { summary } = await priorityInboxSourceAdapters[source].getConnectionSummary(context);
  if (summary.state !== "connected") {
    return false;
  }

  if (!summary.lastSyncedAt) {
    return true;
  }

  const lastSyncedAt = Date.parse(summary.lastSyncedAt);
  if (!Number.isFinite(lastSyncedAt)) {
    return true;
  }

  return Date.now() - lastSyncedAt >= OUTLOOK_AUTO_SYNC_STALE_MS;
}

export async function syncPriorityInboxSource(
  source: "outlook",
  options?: {
    context?: AdapterConnectionContext;
  }
): Promise<{ ok: true; syncedCount: number } | { ok: false; error: string }> {
  const context = options?.context ?? (await getPriorityInboxContext());
  if (!context) {
    return {
      ok: false,
      error: "No active app user could be resolved for Priority Inbox."
    };
  }

  if ("error" in context) {
    return {
      ok: false,
      error: context.error
    };
  }

  const adapter = priorityInboxSourceAdapters[source];
  const { row, summary } = await adapter.getConnectionSummary(context);
  if (!row || summary.state !== "connected") {
    return {
      ok: false,
      error: summary.statusLabel
    };
  }

  await updateSourceConnection(context, source, {
    connection_status: "connected",
    last_sync_started_at: new Date().toISOString(),
    last_sync_status: "idle",
    last_sync_error: null
  });

  try {
    const syncedCount = await adapter.sync(context, row);
    await updateSourceConnection(context, source, {
      connection_status: "connected",
      last_synced_at: new Date().toISOString(),
      last_sync_status: "success",
      last_sync_error: null
    });

    return {
      ok: true,
      syncedCount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outlook sync failed.";
    await updateSourceConnection(context, source, {
      connection_status:
        message.toLowerCase().includes("refresh token") || message.toLowerCase().includes("reconnect")
          ? "needs_reauth"
          : "error",
      last_sync_status: "error",
      last_sync_error: message
    });

    return {
      ok: false,
      error: message
    };
  }
}

export async function getOutlookAccessTokenForActiveUser(options?: { context?: AdapterConnectionContext }) {
  if (!isOutlookConfigured()) {
    return {
      ok: false as const,
      status: 503 as const,
      error: "Outlook integration is not configured. Set Microsoft OAuth credentials and OUTLOOK_TOKEN_ENCRYPTION_KEY."
    };
  }

  const context = options?.context ?? (await getPriorityInboxContext());
  if (!context) {
    return {
      ok: false as const,
      status: 401 as const,
      error: "No active app user could be resolved for Outlook connection."
    };
  }

  if ("error" in context) {
    return {
      ok: false as const,
      status: 403 as const,
      error: context.error
    };
  }

  const { row, summary } = await priorityInboxSourceAdapters.outlook.getConnectionSummary(context);
  if (!row || summary.state !== "connected") {
    return {
      ok: false as const,
      status: 409 as const,
      error: summary.statusLabel
    };
  }

  try {
    const ensured = await ensureOutlookAccessToken(context, row);
    return {
      ok: true as const,
      accessToken: ensured.accessToken,
      accountLabel: summary.accountLabel ?? null
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 500 as const,
      error: error instanceof Error ? error.message : "Outlook access token could not be loaded."
    };
  }
}

export async function completeOutlookConnection(params: { origin: string; code: string }) {
  const context = await getPriorityInboxContext();
  if (!context) {
    return {
      ok: false as const,
      error: "No active app user could be resolved for Outlook connection."
    };
  }

  if ("error" in context) {
    return {
      ok: false as const,
      error: context.error
    };
  }

  if (!isOutlookConfigured()) {
    return {
      ok: false as const,
      error: "Outlook integration is not configured. Set Microsoft OAuth credentials and OUTLOOK_TOKEN_ENCRYPTION_KEY."
    };
  }

  try {
    const redirectUri = resolveOutlookRedirectUri(params.origin);
    const tokenSet = await exchangeOutlookCodeForTokens({
      code: params.code,
      redirectUri
    });
    const profile = await fetchOutlookProfile(tokenSet.accessToken);
    await ensureSeedPriorityInboxItems();
    await persistOutlookConnection(context, tokenSet, profile);

    const syncResult = await syncPriorityInboxSource("outlook", {
      context
    });

    if (!syncResult.ok) {
      return syncResult;
    }

    return {
      ok: true as const,
      syncedCount: syncResult.syncedCount
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Outlook connection failed."
    };
  }
}

async function persistOutlookConnection(
  context: AdapterConnectionContext,
  tokenSet: OutlookTokenSet,
  profile: OutlookProfile
) {
  const sourceMetadata = {
    connectedAt: new Date().toISOString(),
    displayName: profile.displayName
  };

  await updateSourceConnection(context, "outlook", {
    connection_status: "connected",
    external_account_id: profile.id,
    external_account_email: profile.email,
    external_account_label: profile.displayName,
    delegated_scopes: tokenSet.scopes,
    token_access_ciphertext: encryptOutlookSecret(tokenSet.accessToken),
    token_refresh_ciphertext: tokenSet.refreshToken ? encryptOutlookSecret(tokenSet.refreshToken) : null,
    token_expires_at: tokenSet.expiresAt,
    last_sync_status: "idle",
    last_sync_error: null,
    source_metadata: sourceMetadata
  });
}

export function createOutlookConnectUrlForOrigin(origin: string, state: string) {
  return createOutlookAuthorizationUrl({
    redirectUri: resolveOutlookRedirectUri(origin),
    state
  });
}
