import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createCanonicalCommitmentFromPriorityInbox,
  createCanonicalReferenceFromPriorityInbox,
  createCanonicalTaskFromPriorityInbox
} from "@/lib/capture-library";
import type { ParsedForwardedEmail } from "@/lib/priority-inbox-forwarded";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import {
  formatPriorityInboxTimestamp,
  seedPriorityInboxItems,
  type PriorityInboxCreatedObject,
  type PriorityInboxDisposition,
  type PriorityInboxDispositionReason,
  type PriorityInboxIngestionMode,
  type PriorityInboxItem,
  type PriorityInboxManualAddInput,
  type PriorityInboxSourceCandidate,
  type PriorityInboxTransitionPayload,
  type PriorityInboxVisibleState
} from "@/lib/priority-inbox";
import {
  markPriorityInboxLocalFallbackActive,
  normalizePriorityInboxStorageError,
  shouldBypassPriorityInboxRemoteStorage,
  shouldUsePriorityInboxLocalFallback
} from "@/lib/priority-inbox-errors";
import {
  addLocalManualPriorityInboxItem,
  deleteLocalPriorityInboxItem,
  ensureLocalPriorityInboxSeedItems,
  getLocalForwardedPriorityInboxItemDetail,
  getLocalPriorityInboxItem,
  ingestLocalForwardedPriorityInboxItem,
  listLocalPriorityInboxItems,
  openLocalPriorityInboxSource,
  transitionLocalPriorityInboxItem,
  updateLocalPriorityInboxVisibleState,
  upsertLocalPriorityInboxSourceCandidates
} from "@/lib/priority-inbox-local-store";
import type { SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

export type PriorityInboxRow = {
  id: string;
  user_id: string;
  source: PriorityInboxItem["source"];
  source_label: string;
  source_family: PriorityInboxItem["sourceFamily"];
  ingestion_mode: PriorityInboxIngestionMode;
  source_link: string | null;
  external_message_id: string | null;
  external_thread_id: string | null;
  received_at: string | null;
  sender: string;
  sender_role: string | null;
  thread_title: string;
  primary_line: string;
  summary: string;
  time_label: string;
  visible_state: PriorityInboxVisibleState;
  prior_visible_state: PriorityInboxItem["priorVisibleState"] | null;
  deferred_until: string | null;
  deferred_label: string | null;
  deferred_reason: PriorityInboxItem["deferredReason"] | null;
  disposition: PriorityInboxDisposition | null;
  disposition_reason: PriorityInboxDispositionReason | null;
  disposition_label: string | null;
  updated_cue: string | null;
  relationship_cue: string | null;
  sensitive_context: string | null;
  attachment_cue: string | null;
  grouped_cue: string | null;
  why_surfaced: string;
  supporting_signals: unknown;
  recommended_action: PriorityInboxItem["recommendedAction"];
  task_prefill: unknown;
  commitment_prefill: unknown;
  initiative_prefill: unknown;
  reference_prefill: unknown;
  created_object: unknown;
  source_metadata: unknown;
  sort_order: number;
  last_changed_at: string;
  created_at: string;
  updated_at: string;
};

type ForwardedEmailSourceRow = {
  id: string;
  item_id: string;
  user_id: string;
  destination_address: string;
  forwarded_by_name: string | null;
  forwarded_by_email: string | null;
  original_sender_name: string | null;
  original_sender_email: string | null;
  original_subject: string | null;
  original_received_at: string | null;
  forwarded_at: string | null;
  provider_hint: string | null;
  native_source_link: string | null;
  raw_content: string;
  detail_body: string | null;
  attachment_names: string[] | null;
  parsed_headers: unknown;
  source_metadata: unknown;
  created_at: string;
  updated_at: string;
};

type PriorityInboxEventAction =
  | "seeded"
  | "manual_add"
  | "inbound_received"
  | "source_opened"
  | "transition"
  | "promoted"
  | "demoted"
  | "restored";

type PriorityInboxMutationResult =
  | {
      ok: true;
      item: PriorityInboxItem;
    }
  | {
      ok: false;
      error: string;
    };

type PriorityInboxClient = NonNullable<NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>>["client"]>;
type PriorityInboxDbClient = SupabaseClient;
export type PriorityInboxContext =
  | {
      resolved: NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>>;
      client: PriorityInboxClient;
    }
  | {
      error: string;
    };

const PRIORITY_INBOX_SELECT = `
  id,
  user_id,
  source,
  source_label,
  source_family,
  ingestion_mode,
  source_link,
  external_message_id,
  external_thread_id,
  received_at,
  sender,
  sender_role,
  thread_title,
  primary_line,
  summary,
  time_label,
  visible_state,
  prior_visible_state,
  deferred_until,
  deferred_label,
  deferred_reason,
  disposition,
  disposition_reason,
  disposition_label,
  updated_cue,
  relationship_cue,
  sensitive_context,
  attachment_cue,
  grouped_cue,
  why_surfaced,
  supporting_signals,
  recommended_action,
  task_prefill,
  commitment_prefill,
  initiative_prefill,
  reference_prefill,
  created_object,
  source_metadata,
  sort_order,
  last_changed_at,
  created_at,
  updated_at
`;

function logPriorityInbox(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[priority-inbox]", message, details ?? {});
}

function canAutoSeedPriorityInbox() {
  return process.env.NODE_ENV !== "production";
}

function seededPriorityInboxFallback() {
  return seedPriorityInboxItems.map((item) => ({
    ...item,
    supportingSignals: [...item.supportingSignals],
    taskPrefill: item.taskPrefill ? { ...item.taskPrefill } : undefined,
    commitmentPrefill: item.commitmentPrefill ? { ...item.commitmentPrefill } : undefined,
    initiativePrefill: item.initiativePrefill ? { ...item.initiativePrefill } : undefined,
    referencePrefill: item.referencePrefill ? { ...item.referencePrefill } : undefined,
    createdObject: item.createdObject ? { ...item.createdObject } : null,
    sourceMetadata: item.sourceMetadata ? { ...item.sourceMetadata } : null
  }));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function mapJsonRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function mapCreatedObject(value: unknown): PriorityInboxCreatedObject | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  const id = value.id;
  const title = value.title;
  const href = value.href;

  if (
    (type === "task" || type === "commitment" || type === "initiative" || type === "reference") &&
    typeof title === "string" &&
    typeof href === "string"
  ) {
    return { id: typeof id === "string" ? id : undefined, type, title, href };
  }

  return null;
}

export function mapPriorityInboxRow(row: PriorityInboxRow): PriorityInboxItem {
  return {
    id: row.id,
    source: row.source,
    sourceLabel: row.source_label,
    sourceFamily: row.source_family,
    ingestionMode: row.ingestion_mode ?? (row.source === "manual" ? "manual" : "live_adapter"),
    sourceLink: row.source_link,
    externalMessageId: row.external_message_id,
    conversationId: row.external_thread_id,
    receivedAt: row.received_at,
    sender: row.sender,
    senderRole: row.sender_role ?? undefined,
    threadTitle: row.thread_title,
    primaryLine: row.primary_line,
    summary: row.summary,
    timeLabel: row.time_label,
    visibleState: row.visible_state,
    priorVisibleState: row.prior_visible_state ?? undefined,
    deferredUntil: row.deferred_until,
    deferredLabel: row.deferred_label,
    deferredReason: row.deferred_reason,
    disposition: row.disposition,
    dispositionReason: row.disposition_reason,
    dispositionLabel: row.disposition_label,
    updatedCue: row.updated_cue,
    relationshipCue: row.relationship_cue,
    sensitiveContext: row.sensitive_context,
    attachmentCue: row.attachment_cue,
    groupedCue: row.grouped_cue,
    whySurfaced: row.why_surfaced,
    supportingSignals: isStringArray(row.supporting_signals) ? row.supporting_signals : [],
    recommendedAction: row.recommended_action,
    taskPrefill: isRecord(row.task_prefill) ? (row.task_prefill as PriorityInboxItem["taskPrefill"]) : undefined,
    commitmentPrefill: isRecord(row.commitment_prefill)
      ? (row.commitment_prefill as PriorityInboxItem["commitmentPrefill"])
      : undefined,
    initiativePrefill: isRecord(row.initiative_prefill)
      ? (row.initiative_prefill as PriorityInboxItem["initiativePrefill"])
      : undefined,
    referencePrefill: isRecord(row.reference_prefill)
      ? (row.reference_prefill as PriorityInboxItem["referencePrefill"])
      : undefined,
    createdObject: mapCreatedObject(row.created_object),
    lastChangedAt: row.last_changed_at,
    sourceMetadata: mapJsonRecord(row.source_metadata)
  };
}

function timeLabelForVisibleState(state: PriorityInboxVisibleState, deferredLabel?: string | null) {
  if (state === "deferred") {
    return deferredLabel ? `Deferred until ${deferredLabel}` : "Deferred";
  }

  if (state === "handled") {
    return "Handled just now";
  }

  if (state === "dismissed") {
    return "Dismissed just now";
  }

  return "Updated just now";
}

function itemToInsertRecord(item: PriorityInboxItem, userId: string, sortOrder: number): JsonRecord {
  return {
    user_id: userId,
    source: item.source,
    source_label: item.sourceLabel,
    source_family: item.sourceFamily,
    ingestion_mode: item.ingestionMode,
    source_link: item.sourceLink,
    external_message_id: item.externalMessageId ?? null,
    external_thread_id: item.conversationId ?? null,
    received_at: item.receivedAt ?? null,
    sender: item.sender,
    sender_role: item.senderRole ?? null,
    thread_title: item.threadTitle,
    primary_line: item.primaryLine,
    summary: item.summary,
    time_label: item.timeLabel,
    visible_state: item.visibleState,
    prior_visible_state: item.priorVisibleState ?? null,
    deferred_until: item.deferredUntil ?? null,
    deferred_label: item.deferredLabel ?? null,
    deferred_reason: item.deferredReason ?? null,
    disposition: item.disposition ?? null,
    disposition_reason: item.dispositionReason ?? null,
    disposition_label: item.dispositionLabel ?? null,
    updated_cue: item.updatedCue ?? null,
    relationship_cue: item.relationshipCue ?? null,
    sensitive_context: item.sensitiveContext ?? null,
    attachment_cue: item.attachmentCue ?? null,
    grouped_cue: item.groupedCue ?? null,
    why_surfaced: item.whySurfaced,
    supporting_signals: item.supportingSignals,
    recommended_action: item.recommendedAction,
    task_prefill: item.taskPrefill ?? null,
    commitment_prefill: item.commitmentPrefill ?? null,
    initiative_prefill: item.initiativePrefill ?? null,
    reference_prefill: item.referencePrefill ?? null,
    created_object: item.createdObject ?? null,
    source_metadata: item.sourceMetadata ?? {},
    sort_order: sortOrder,
    last_changed_at: item.lastChangedAt ?? new Date().toISOString()
  };
}

async function appendPriorityInboxEvent(params: {
  client: PriorityInboxDbClient;
  itemId: string;
  userId: string;
  action: PriorityInboxEventAction;
  fromState?: PriorityInboxVisibleState | null;
  toState?: PriorityInboxVisibleState | null;
  disposition?: PriorityInboxDisposition | null;
  dispositionReason?: PriorityInboxDispositionReason | string | null;
  source?: PriorityInboxItem["source"] | null;
  createdObject?: PriorityInboxCreatedObject | null;
  metadata?: JsonRecord;
}) {
  const { error } = await params.client.from("priority_inbox_events").insert({
    item_id: params.itemId,
    user_id: params.userId,
    action: params.action,
    from_state: params.fromState ?? null,
    to_state: params.toState ?? null,
    disposition: params.disposition ?? null,
    reason: params.dispositionReason ?? null,
    disposition_reason: params.dispositionReason ?? null,
    source: params.source ?? null,
    created_object: params.createdObject ?? null,
    metadata: params.metadata ?? {}
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getPriorityInboxContext(): Promise<PriorityInboxContext | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const adminClient = createSupabaseAdminClient();
  return {
    resolved,
    client: adminClient ?? resolved.client
  } as const;
}

export async function ensureSeedPriorityInboxItems() {
  const context = await getPriorityInboxContext();
  if (!context || "error" in context) {
    return;
  }

  const { client, resolved } = context;
  if (resolved.source !== "bootstrap" || !canAutoSeedPriorityInbox()) {
    return;
  }

  if (shouldBypassPriorityInboxRemoteStorage()) {
    await ensureLocalPriorityInboxSeedItems(resolved.user.id);
    return;
  }

  try {
    const existing = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", resolved.user.id)
    );

    if ((existing.count ?? 0) > 0) {
      return;
    }

    const rows = seedPriorityInboxItems.map((item, index) => itemToInsertRecord(item, resolved.user.id, index));
    const insert = await withSupabaseTimeout(
      client.from("priority_inbox_items").insert(rows).select("id").returns<Array<{ id: string }>>()
    );

    if (insert.error || !insert.data) {
      throw new Error(insert.error?.message ?? "Unknown seed error.");
    }

    await Promise.all(
      insert.data.map((row, index) =>
        appendPriorityInboxEvent({
          client,
          itemId: row.id,
          userId: resolved.user.id,
          action: "seeded",
          toState: seedPriorityInboxItems[index]?.visibleState ?? "needs_review",
          source: seedPriorityInboxItems[index]?.source ?? null,
          metadata: { seedId: seedPriorityInboxItems[index]?.id ?? null }
        }).catch((error) => {
          logPriorityInbox("Failed to append seed event.", {
            itemId: row.id,
            error: error instanceof Error ? error.message : String(error)
          });
        })
      )
    );
  } catch (error) {
    const normalizedError = normalizePriorityInboxStorageError(error, "Unknown seed error.");
    logPriorityInbox("Failed to seed Priority Inbox items.", {
      userId: resolved.user.id,
      error: normalizedError
    });

    if (shouldUsePriorityInboxLocalFallback(error)) {
      markPriorityInboxLocalFallbackActive();
      await ensureLocalPriorityInboxSeedItems(resolved.user.id);
    }
  }
}

export async function listPriorityInboxItems(): Promise<PriorityInboxItem[]> {
  const context = await getPriorityInboxContext();
  if (!context || "error" in context) {
    return [];
  }

  await ensureSeedPriorityInboxItems();

  const { client, resolved } = context;
  if (shouldBypassPriorityInboxRemoteStorage()) {
    await ensureLocalPriorityInboxSeedItems(resolved.user.id);
    return await listLocalPriorityInboxItems(resolved.user.id);
  }

  try {
    const response = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .select(PRIORITY_INBOX_SELECT)
        .eq("user_id", resolved.user.id)
        .order("sort_order", { ascending: true })
        .order("last_changed_at", { ascending: false })
        .returns<PriorityInboxRow[]>()
    );

    if (response.error || !response.data) {
      throw new Error(response.error?.message ?? "Unknown load error.");
    }

    return response.data.map(mapPriorityInboxRow);
  } catch (error) {
    logPriorityInbox("Failed to load Priority Inbox items.", {
      userId: resolved.user.id,
      error: normalizePriorityInboxStorageError(error, "Unknown load error.")
    });

    if (shouldUsePriorityInboxLocalFallback(error)) {
      markPriorityInboxLocalFallbackActive();
      await ensureLocalPriorityInboxSeedItems(resolved.user.id);
      return await listLocalPriorityInboxItems(resolved.user.id);
    }

    if (resolved.source === "bootstrap" && canAutoSeedPriorityInbox()) {
      return seededPriorityInboxFallback();
    }

    return [];
  }
}

async function upsertPriorityInboxSourceCandidatesForUser(params: {
  client: PriorityInboxDbClient;
  userId: string;
  candidates: PriorityInboxSourceCandidate[];
}) {
  if (params.candidates.length === 0) {
    return [];
  }

  const existingResponse = await withSupabaseTimeout(
    params.client
      .from("priority_inbox_items")
      .select(PRIORITY_INBOX_SELECT)
      .eq("user_id", params.userId)
      .in(
        "external_message_id",
        params.candidates.map((candidate) => candidate.externalMessageId)
      )
      .returns<PriorityInboxRow[]>()
  );

  if (existingResponse.error) {
    throw new Error(existingResponse.error.message);
  }

  const existingByExternalId = new Map(
    (existingResponse.data ?? []).map((row) => [row.external_message_id ?? "", row] as const)
  );
  const nowIso = new Date().toISOString();

  const rows = params.candidates.map((candidate, index) => {
    const existing = existingByExternalId.get(candidate.externalMessageId);

    return {
      user_id: params.userId,
      source: candidate.source,
      source_label: candidate.sourceLabel,
      source_family: candidate.sourceFamily,
      ingestion_mode: candidate.ingestionMode ?? (candidate.source === "forwarded_email" ? "forwarded" : "live_adapter"),
      source_link: candidate.sourceLink,
      external_message_id: candidate.externalMessageId,
      external_thread_id: candidate.conversationId ?? null,
      received_at: candidate.receivedAt,
      sender: candidate.sender,
      sender_role: candidate.senderRole ?? null,
      thread_title: candidate.subject,
      primary_line: candidate.primaryLine,
      summary: candidate.snippet,
      time_label: formatPriorityInboxTimestamp(candidate.receivedAt),
      visible_state: existing?.visible_state ?? candidate.visibleState,
      prior_visible_state: existing?.prior_visible_state ?? candidate.visibleState,
      deferred_until: existing?.deferred_until ?? null,
      deferred_label: existing?.deferred_label ?? null,
      deferred_reason: existing?.deferred_reason ?? null,
      disposition: existing?.disposition ?? null,
      disposition_reason: existing?.disposition_reason ?? candidate.dispositionReason ?? null,
      disposition_label: existing?.disposition_label ?? null,
      updated_cue: candidate.updatedCue ?? existing?.updated_cue ?? null,
      relationship_cue: candidate.relationshipCue ?? existing?.relationship_cue ?? null,
      sensitive_context: candidate.sensitiveContext ?? existing?.sensitive_context ?? null,
      attachment_cue: candidate.attachmentCue ?? existing?.attachment_cue ?? null,
      grouped_cue: candidate.groupedCue ?? existing?.grouped_cue ?? null,
      why_surfaced: candidate.whySurfaced,
      supporting_signals: candidate.supportingSignals,
      recommended_action: candidate.recommendedAction,
      task_prefill: candidate.taskPrefill ?? existing?.task_prefill ?? null,
      commitment_prefill: candidate.commitmentPrefill ?? existing?.commitment_prefill ?? null,
      initiative_prefill: candidate.initiativePrefill ?? existing?.initiative_prefill ?? null,
      reference_prefill: candidate.referencePrefill ?? existing?.reference_prefill ?? null,
      created_object: existing?.created_object ?? null,
      source_metadata: candidate.sourceMetadata ?? existing?.source_metadata ?? {},
      sort_order: existing?.sort_order ?? -1000 + index,
      last_changed_at: existing?.last_changed_at ?? nowIso
    };
  });

  const upsert = await withSupabaseTimeout(
    params.client
      .from("priority_inbox_items")
      .upsert(rows, {
        onConflict: "user_id,source,external_message_id"
      })
      .select(PRIORITY_INBOX_SELECT)
      .returns<PriorityInboxRow[]>()
  );

  if (upsert.error || !upsert.data) {
    throw new Error(upsert.error?.message ?? "Priority Inbox source items could not be upserted.");
  }

  return upsert.data.map(mapPriorityInboxRow);
}

export async function upsertPriorityInboxSourceCandidates(params: {
  context: Extract<PriorityInboxContext, { resolved: NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>> }>;
  candidates: PriorityInboxSourceCandidate[];
}) {
  if (shouldBypassPriorityInboxRemoteStorage()) {
    return await upsertLocalPriorityInboxSourceCandidates({
      userId: params.context.resolved.user.id,
      candidates: params.candidates
    });
  }

  try {
    return await upsertPriorityInboxSourceCandidatesForUser({
      client: params.context.client,
      userId: params.context.resolved.user.id,
      candidates: params.candidates
    });
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      throw error;
    }

    markPriorityInboxLocalFallbackActive();
    return await upsertLocalPriorityInboxSourceCandidates({
      userId: params.context.resolved.user.id,
      candidates: params.candidates
    });
  }
}

export async function ingestForwardedPriorityInboxItem(params: {
  client: PriorityInboxDbClient;
  userId: string;
  destinationAddress: string;
  parsed: ParsedForwardedEmail;
  provider?: "cloudmailin" | "generic";
  providerMetadata?: JsonRecord;
}) {
  if (shouldBypassPriorityInboxRemoteStorage()) {
    return await ingestLocalForwardedPriorityInboxItem({
      userId: params.userId,
      destinationAddress: params.destinationAddress,
      parsed: params.parsed,
      provider: params.provider,
      providerMetadata: params.providerMetadata
    });
  }

  try {
    const existingResponse = await withSupabaseTimeout(
      params.client
        .from("priority_inbox_items")
        .select("id")
        .eq("user_id", params.userId)
        .eq("source", "forwarded_email")
        .eq("external_message_id", params.parsed.externalMessageId)
        .maybeSingle<{ id: string }>()
    );

    if (existingResponse.error) {
      throw new Error(existingResponse.error.message);
    }

    const deduplicated = Boolean(existingResponse.data?.id);
    const [item] = await upsertPriorityInboxSourceCandidatesForUser({
      client: params.client,
      userId: params.userId,
      candidates: [
        {
          source: "forwarded_email",
          sourceLabel: "Forwarded email",
          sourceFamily: "email",
          ingestionMode: "forwarded",
          sourceLink: params.parsed.sourceLink,
          externalMessageId: params.parsed.externalMessageId,
          conversationId: params.parsed.conversationId,
          receivedAt: params.parsed.receivedAt ?? params.parsed.forwardedAt ?? new Date().toISOString(),
          sender: params.parsed.sender,
          senderRole: params.parsed.senderRole,
          subject: params.parsed.subject,
          primaryLine: params.parsed.primaryLine,
          snippet: params.parsed.snippet,
          visibleState: "needs_review",
          whySurfaced: params.parsed.whySurfaced,
          supportingSignals: params.parsed.supportingSignals,
          recommendedAction: params.parsed.recommendedAction,
          attachmentCue: params.parsed.attachmentCue,
          taskPrefill: params.parsed.taskPrefill,
          commitmentPrefill: params.parsed.commitmentPrefill,
          referencePrefill: params.parsed.referencePrefill,
          sourceMetadata: params.parsed.sourceMetadata
        }
      ]
    });

    if (!item) {
      throw new Error("Forwarded email could not be written to Priority Inbox.");
    }

    const upsertDetail = await withSupabaseTimeout(
      params.client.from("priority_inbox_forwarded_email_sources").upsert(
        {
          item_id: item.id,
          user_id: params.userId,
          destination_address: params.destinationAddress.toLowerCase(),
          forwarded_by_name: params.parsed.forwardedByName,
          forwarded_by_email: params.parsed.forwardedByEmail,
          original_sender_name: params.parsed.originalSenderName,
          original_sender_email: params.parsed.originalSenderEmail,
          original_subject: params.parsed.subject,
          original_received_at: params.parsed.originalReceivedAt,
          forwarded_at: params.parsed.forwardedAt,
          provider_hint: params.parsed.providerHint,
          native_source_link: params.parsed.sourceLink,
          raw_content: params.parsed.rawContent,
          detail_body: params.parsed.detailBody,
          attachment_names: params.parsed.attachmentNames,
          parsed_headers: params.parsed.parsedHeaders,
          source_metadata: {
            ...params.parsed.sourceMetadata,
            rawContentTruncated: params.parsed.rawContentTruncated
          }
        },
        {
          onConflict: "item_id"
        }
      )
    );

    if (upsertDetail.error) {
      throw new Error(upsertDetail.error.message);
    }

    await appendPriorityInboxEvent({
      client: params.client,
      itemId: item.id,
      userId: params.userId,
      action: "inbound_received",
      toState: item.visibleState,
      source: item.source,
      metadata: {
        destinationAddress: params.destinationAddress,
        ingestionMode: "forwarded",
        provider: params.provider ?? "generic",
        externalMessageId: params.parsed.externalMessageId,
        deduplicated,
        ...(params.providerMetadata ?? {})
      }
    });

    return {
      item,
      deduplicated
    };
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      throw error;
    }

    markPriorityInboxLocalFallbackActive();
    return await ingestLocalForwardedPriorityInboxItem({
      userId: params.userId,
      destinationAddress: params.destinationAddress,
      parsed: params.parsed,
      provider: params.provider,
      providerMetadata: params.providerMetadata
    });
  }
}

export async function getForwardedPriorityInboxItemDetail(itemId: string) {
  const result = await getPriorityInboxItemRow(itemId);
  if ("error" in result) {
    const context = await getPriorityInboxContext();
    if (!context || "error" in context) {
      return null;
    }

    return await getLocalForwardedPriorityInboxItemDetail(context.resolved.user.id, itemId);
  }

  const localItem = "localItem" in result ? (result.localItem ?? null) : null;

  if (localItem) {
    if (localItem.source !== "forwarded_email") {
      return null;
    }

    return await getLocalForwardedPriorityInboxItemDetail(result.context.resolved.user.id, itemId);
  }

  if (shouldBypassPriorityInboxRemoteStorage()) {
    return await getLocalForwardedPriorityInboxItemDetail(result.context.resolved.user.id, itemId);
  }

  const row = result.row;
  if (!row || row.source !== "forwarded_email") {
    return null;
  }

  try {
    const detailResponse = await withSupabaseTimeout(
      result.context.client
        .from("priority_inbox_forwarded_email_sources")
        .select(
          "id, item_id, user_id, destination_address, forwarded_by_name, forwarded_by_email, original_sender_name, original_sender_email, original_subject, original_received_at, forwarded_at, provider_hint, native_source_link, raw_content, detail_body, attachment_names, parsed_headers, source_metadata, created_at, updated_at"
        )
        .eq("item_id", itemId)
        .eq("user_id", result.context.resolved.user.id)
        .maybeSingle<ForwardedEmailSourceRow>()
    );

    if (detailResponse.error || !detailResponse.data) {
      throw new Error(detailResponse.error?.message ?? "Forwarded email detail could not be loaded.");
    }

    return {
      item: mapPriorityInboxRow(row),
      detail: detailResponse.data
    };
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      return null;
    }

    markPriorityInboxLocalFallbackActive();
    return await getLocalForwardedPriorityInboxItemDetail(result.context.resolved.user.id, itemId);
  }
}

async function getPriorityInboxItemRow(itemId: string) {
  const context = await getPriorityInboxContext();
  if (!context) {
    return { error: "No active app user could be resolved for Priority Inbox." } as const;
  }

  if ("error" in context) {
    return { error: context.error } as const;
  }

  if (shouldBypassPriorityInboxRemoteStorage()) {
    const localItem = await getLocalPriorityInboxItem(context.resolved.user.id, itemId);
    if (localItem) {
      return {
        context,
        localItem
      } as const;
    }
  }

  try {
    const response = await withSupabaseTimeout(
      context.client
        .from("priority_inbox_items")
        .select(PRIORITY_INBOX_SELECT)
        .eq("user_id", context.resolved.user.id)
        .eq("id", itemId)
        .maybeSingle<PriorityInboxRow>()
    );

    if (response.error || !response.data) {
      throw new Error(response.error?.message ?? "Priority Inbox item could not be found.");
    }

    return {
      context,
      row: response.data
    } as const;
  } catch (error) {
    if (shouldUsePriorityInboxLocalFallback(error)) {
      markPriorityInboxLocalFallbackActive();
      const localItem = await getLocalPriorityInboxItem(context.resolved.user.id, itemId);
      if (localItem) {
        return {
          context,
          localItem
        } as const;
      }
    }

    return {
      error: error instanceof Error ? error.message : "Priority Inbox item could not be found."
    } as const;
  }
}

export async function addManualPriorityInboxItem(input: PriorityInboxManualAddInput): Promise<PriorityInboxMutationResult> {
  const context = await getPriorityInboxContext();
  if (!context) {
    return {
      ok: false,
      error: "No active app user could be resolved for Priority Inbox."
    };
  }

  if ("error" in context) {
    return {
      ok: false,
      error: context.error ?? "Priority Inbox bootstrap persistence is unavailable."
    };
  }

  const { client, resolved } = context;
  const deferredTimestamp =
    input.visibleState === "deferred" && input.deferredUntil ? new Date(input.deferredUntil).toISOString() : null;
  if (shouldBypassPriorityInboxRemoteStorage()) {
    await ensureLocalPriorityInboxSeedItems(resolved.user.id);
    const item = await addLocalManualPriorityInboxItem(resolved.user.id, input);
    return {
      ok: true,
      item
    };
  }

  try {
    const insert = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .insert({
          user_id: resolved.user.id,
          source: "manual",
          source_label: "Manual / Capture",
          source_family: "manual",
          ingestion_mode: "manual",
          source_link: input.sourceLink,
          sender: input.sender,
          thread_title: input.threadTitle,
          primary_line: input.primaryLine,
          summary: input.summary,
          time_label: "Added just now",
          visible_state: input.visibleState,
          prior_visible_state: input.visibleState === "high_priority" ? "high_priority" : "needs_review",
          deferred_until: deferredTimestamp,
          deferred_label: deferredTimestamp ? formatPriorityInboxTimestamp(deferredTimestamp) : null,
          deferred_reason: deferredTimestamp ? "not_now" : null,
          why_surfaced: input.whySurfaced,
          supporting_signals: ["Manual routing signal"],
          recommended_action: input.visibleState === "high_priority" ? "create_task" : "save_reference",
          sensitive_context: input.sensitiveContext ?? null,
          reference_prefill: {
            title: input.threadTitle,
            summary: input.summary
          },
          sort_order: -1,
          last_changed_at: new Date().toISOString()
        })
        .select(PRIORITY_INBOX_SELECT)
        .single<PriorityInboxRow>()
    );

    if (insert.error || !insert.data) {
      throw new Error(insert.error?.message ?? "Manual inbox item could not be created.");
    }

    await appendPriorityInboxEvent({
      client,
      itemId: insert.data.id,
      userId: resolved.user.id,
      action: "manual_add",
      toState: insert.data.visible_state,
      source: insert.data.source,
      metadata: { sourceLink: input.sourceLink }
    });

    return {
      ok: true,
      item: mapPriorityInboxRow(insert.data)
    };
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Manual inbox item could not be created."
      };
    }

    markPriorityInboxLocalFallbackActive();
    await ensureLocalPriorityInboxSeedItems(resolved.user.id);
    const item = await addLocalManualPriorityInboxItem(resolved.user.id, input);
    return {
      ok: true,
      item
    };
  }
}

export async function openPriorityInboxSource(itemId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await getPriorityInboxItemRow(itemId);
  if ("error" in result) {
    return {
      ok: false,
      error: result.error ?? "Priority Inbox item could not be found."
    };
  }

  if ("localItem" in result && result.localItem) {
    const item = await openLocalPriorityInboxSource(result.context.resolved.user.id, itemId);
    if (!item) {
      return {
        ok: false,
        error: "Priority Inbox item could not be found."
      };
    }

    return { ok: true };
  }

  try {
    await appendPriorityInboxEvent({
      client: result.context.client,
      itemId: result.row.id,
      userId: result.context.resolved.user.id,
      action: "source_opened",
      fromState: result.row.visible_state,
      toState: result.row.visible_state,
      disposition: "source_opened",
      source: result.row.source
    });
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Priority Inbox source event could not be recorded."
      };
    }

    markPriorityInboxLocalFallbackActive();
    await openLocalPriorityInboxSource(result.context.resolved.user.id, itemId);
  }

  return { ok: true };
}

export async function transitionPriorityInboxItem(
  itemId: string,
  payload: PriorityInboxTransitionPayload
): Promise<PriorityInboxMutationResult> {
  const result = await getPriorityInboxItemRow(itemId);
  if ("error" in result) {
    return {
      ok: false,
      error: result.error ?? "Priority Inbox item could not be found."
    };
  }

  const localItem = "localItem" in result ? (result.localItem ?? null) : null;
  const row = "row" in result ? (result.row ?? null) : null;
  const currentItem = localItem ?? (row ? mapPriorityInboxRow(row) : null);
  const currentVisibleState = localItem ? localItem.visibleState : row?.visible_state;

  if (!currentItem || !currentVisibleState) {
    return {
      ok: false,
      error: "Priority Inbox item could not be found."
    };
  }

  if (currentVisibleState === "high_priority") {
    const confirmationExpiresAtValue = payload.confirmationExpiresAt;
    const confirmationExpiresAt = confirmationExpiresAtValue ? Date.parse(confirmationExpiresAtValue) : Number.NaN;

    if (!confirmationExpiresAtValue || Number.isNaN(confirmationExpiresAt) || Date.now() < confirmationExpiresAt) {
      return {
        ok: false,
        error: "High Priority items stay in a confirmation window until the undo period expires."
      };
    }
  }

  let createdObject = payload.createdObject ?? null;

  if (payload.disposition === "task_created" && !payload.canonicalTask) {
    return {
      ok: false,
      error: "Task creation requires canonical task details."
    };
  }

  if (payload.disposition === "commitment_created" && !payload.canonicalCommitment) {
    return {
      ok: false,
      error: "Commitment creation requires canonical commitment details."
    };
  }

  if (payload.disposition === "reference_saved" && !payload.canonicalReference) {
    return {
      ok: false,
      error: "Saving a reference requires canonical reference details."
    };
  }

  const localTransition = async () => {
    const item = await transitionLocalPriorityInboxItem({
      userId: result.context.resolved.user.id,
      itemId,
      payload: {
        ...payload,
        createdObject
      }
    });

    if (!item) {
      return {
        ok: false,
        error: "Priority Inbox item could not be updated."
      } satisfies PriorityInboxMutationResult;
    }

    return {
      ok: true,
      item
    } satisfies PriorityInboxMutationResult;
  };

  if (localItem) {
    return await localTransition();
  }

  const { client, resolved } = result.context;
  if (!row) {
    return {
      ok: false,
      error: "Priority Inbox item could not be found."
    };
  }

  const priorVisibleState =
    row.visible_state === "high_priority" || row.visible_state === "needs_review"
      ? row.visible_state
      : (row.prior_visible_state ?? "needs_review");

  if (payload.disposition === "task_created" && payload.canonicalTask) {
    const canonicalTask = await createCanonicalTaskFromPriorityInbox({
      item: currentItem,
      task: payload.canonicalTask
    });

    if (!canonicalTask.ok) {
      if (shouldUsePriorityInboxLocalFallback(canonicalTask.error)) {
        markPriorityInboxLocalFallbackActive();
        return await localTransition();
      }

      return {
        ok: false,
        error: canonicalTask.error
      };
    }

    createdObject = {
      id: canonicalTask.object.captureId,
      type: canonicalTask.object.type,
      title: canonicalTask.object.title,
      href: canonicalTask.object.href
    };
  }

  if (payload.disposition === "commitment_created" && payload.canonicalCommitment) {
    const canonicalCommitment = await createCanonicalCommitmentFromPriorityInbox({
      item: currentItem,
      commitment: payload.canonicalCommitment
    });

    if (!canonicalCommitment.ok) {
      if (shouldUsePriorityInboxLocalFallback(canonicalCommitment.error)) {
        markPriorityInboxLocalFallbackActive();
        return await localTransition();
      }

      return {
        ok: false,
        error: canonicalCommitment.error
      };
    }

    createdObject = {
      id: canonicalCommitment.object.captureId,
      type: "commitment",
      title: canonicalCommitment.object.title,
      href: canonicalCommitment.object.href
    };
  }

  if (payload.disposition === "reference_saved" && payload.canonicalReference) {
    const canonicalReference = await createCanonicalReferenceFromPriorityInbox({
      item: currentItem,
      reference: payload.canonicalReference
    });

    if (!canonicalReference.ok) {
      if (shouldUsePriorityInboxLocalFallback(canonicalReference.error)) {
        markPriorityInboxLocalFallbackActive();
        return await localTransition();
      }

      return {
        ok: false,
        error: canonicalReference.error
      };
    }

    createdObject = {
      id: canonicalReference.object.captureId,
      type: canonicalReference.object.type,
      title: canonicalReference.object.title,
      href: canonicalReference.object.href
    };
  }

  try {
    const update = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .update({
          visible_state: payload.nextState,
          prior_visible_state: priorVisibleState,
          deferred_until: payload.nextState === "deferred" ? payload.deferredUntil ?? null : null,
          deferred_label: payload.nextState === "deferred" ? payload.deferredLabel ?? null : null,
          deferred_reason: payload.nextState === "deferred" ? payload.deferredReason ?? null : null,
          disposition: payload.disposition,
          disposition_reason: payload.dispositionReason ?? null,
          disposition_label: payload.dispositionLabel,
          created_object: createdObject,
          updated_cue: null,
          time_label: timeLabelForVisibleState(payload.nextState, payload.deferredLabel),
          last_changed_at: new Date().toISOString()
        })
        .eq("user_id", resolved.user.id)
        .eq("id", itemId)
        .select(PRIORITY_INBOX_SELECT)
        .single<PriorityInboxRow>()
    );

    if (update.error || !update.data) {
      throw new Error(update.error?.message ?? "Priority Inbox item could not be updated.");
    }

    await appendPriorityInboxEvent({
      client,
      itemId,
      userId: resolved.user.id,
      action: "transition",
      fromState: row.visible_state,
      toState: payload.nextState,
      disposition: payload.disposition,
      dispositionReason:
        payload.nextState === "deferred" ? payload.deferredReason ?? null : payload.dispositionReason ?? null,
      source: row.source,
      createdObject,
      metadata:
        payload.nextState === "deferred"
          ? {
              deferredUntil: payload.deferredUntil ?? null,
              deferredLabel: payload.deferredLabel ?? null,
              deferredReason: payload.deferredReason ?? null
            }
          : createdObject
            ? { createdObject }
            : {}
    });

    return {
      ok: true,
      item: mapPriorityInboxRow(update.data)
    };
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Priority Inbox item could not be updated."
      };
    }

    markPriorityInboxLocalFallbackActive();
    return await localTransition();
  }
}

async function updatePriorityInboxVisibleState(params: {
  itemId: string;
  nextState: Extract<PriorityInboxVisibleState, "high_priority" | "needs_review">;
  action: Extract<PriorityInboxEventAction, "promoted" | "demoted" | "restored">;
  timeLabel: string;
  updatedCue: string;
}): Promise<PriorityInboxMutationResult> {
  const result = await getPriorityInboxItemRow(params.itemId);
  if ("error" in result) {
    return {
      ok: false,
      error: result.error ?? "Priority Inbox item could not be found."
    };
  }

  const localUpdate = async () => {
    const item = await updateLocalPriorityInboxVisibleState({
      userId: result.context.resolved.user.id,
      itemId: params.itemId,
      nextState: params.nextState,
      action: params.action,
      timeLabel: params.timeLabel,
      updatedCue: params.updatedCue
    });

    if (!item) {
      return {
        ok: false,
        error: "Priority Inbox item could not be updated."
      } satisfies PriorityInboxMutationResult;
    }

    return {
      ok: true,
      item
    } satisfies PriorityInboxMutationResult;
  };

  if ("localItem" in result && result.localItem) {
    return await localUpdate();
  }

  const { client, resolved } = result.context;

  try {
    const update = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .update({
          visible_state: params.nextState,
          prior_visible_state: params.nextState,
          deferred_until: null,
          deferred_label: null,
          deferred_reason: null,
          disposition: null,
          disposition_reason: null,
          disposition_label: null,
          updated_cue: params.updatedCue,
          time_label: params.timeLabel,
          last_changed_at: new Date().toISOString()
        })
        .eq("user_id", resolved.user.id)
        .eq("id", params.itemId)
        .select(PRIORITY_INBOX_SELECT)
        .single<PriorityInboxRow>()
    );

    if (update.error || !update.data) {
      throw new Error(update.error?.message ?? "Priority Inbox item could not be updated.");
    }

    await appendPriorityInboxEvent({
      client,
      itemId: params.itemId,
      userId: resolved.user.id,
      action: params.action,
      fromState: result.row.visible_state,
      toState: params.nextState,
      source: result.row.source
    });

    return {
      ok: true,
      item: mapPriorityInboxRow(update.data)
    };
  } catch (error) {
    if (!shouldUsePriorityInboxLocalFallback(error)) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Priority Inbox item could not be updated."
      };
    }

    markPriorityInboxLocalFallbackActive();
    return await localUpdate();
  }
}

export async function promotePriorityInboxItem(itemId: string): Promise<PriorityInboxMutationResult> {
  return await updatePriorityInboxVisibleState({
    itemId,
    nextState: "high_priority",
    action: "promoted",
    timeLabel: "Updated just now",
    updatedCue: "Promoted"
  });
}

export async function demotePriorityInboxItem(itemId: string): Promise<PriorityInboxMutationResult> {
  return await updatePriorityInboxVisibleState({
    itemId,
    nextState: "needs_review",
    action: "demoted",
    timeLabel: "Updated just now",
    updatedCue: "Moved to review"
  });
}

export async function restorePriorityInboxItem(itemId: string): Promise<PriorityInboxMutationResult> {
  const result = await getPriorityInboxItemRow(itemId);
  if ("error" in result) {
    return {
      ok: false,
      error: result.error ?? "Priority Inbox item could not be found."
    };
  }

  const restoreTarget =
    "localItem" in result && result.localItem
      ? (result.localItem.priorVisibleState ?? "needs_review")
      : (result.row.prior_visible_state ?? "needs_review");

  return await updatePriorityInboxVisibleState({
    itemId,
    nextState: restoreTarget,
    action: "restored",
    timeLabel: "Restored just now",
    updatedCue: "Restored"
  });
}

export async function deletePriorityInboxItem(itemId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await getPriorityInboxItemRow(itemId);
  if ("error" in result) {
    return {
      ok: false,
      error: result.error ?? "Priority Inbox item could not be found."
    };
  }

  const userId = result.context.resolved.user.id;

  if ("localItem" in result && result.localItem) {
    await deleteLocalPriorityInboxItem(userId, itemId);
    return { ok: true };
  }

  const { client } = result.context;

  try {
    const { error } = await withSupabaseTimeout(
      client
        .from("priority_inbox_items")
        .delete()
        .eq("user_id", userId)
        .eq("id", itemId)
    );

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  } catch (error) {
    if (shouldUsePriorityInboxLocalFallback(error)) {
      markPriorityInboxLocalFallbackActive();
      await deleteLocalPriorityInboxItem(userId, itemId);
      return { ok: true };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Priority Inbox item could not be deleted."
    };
  }
}
