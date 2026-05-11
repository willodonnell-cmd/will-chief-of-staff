import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { ParsedForwardedEmail } from "@/lib/priority-inbox-forwarded";
import {
  formatPriorityInboxTimestamp,
  seedPriorityInboxItems,
  type PriorityInboxCreatedObject,
  type PriorityInboxDisposition,
  type PriorityInboxItem,
  type PriorityInboxManualAddInput,
  type PriorityInboxSourceCandidate,
  type PriorityInboxTransitionPayload,
  type PriorityInboxVisibleState
} from "@/lib/priority-inbox";

type JsonRecord = Record<string, unknown>;

type LocalPriorityInboxItemRecord = {
  userId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  item: PriorityInboxItem;
};

export type LocalPriorityInboxLibraryRecord = {
  id: string;
  user_id: string;
  source_path: string | null;
  pattern: "note" | "task";
  privacy: "open" | "protected" | "hybrid";
  summary: string;
  follow_up: string | null;
  private_context: string | null;
  type: "note" | "task";
  title: string;
  note_title: string | null;
  note_body: string | null;
  task_description: string | null;
  task_next_step: string | null;
  task_desired_outcome: string | null;
  task_category_id: string | null;
  linked_initiative_id: string | null;
  origin_capture_id: string | null;
  origin_type: "note" | "task" | "email" | "capture" | null;
  original_content: string;
  working_content: string;
  captured_at: string;
  last_active_at: string;
  archived_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  due_at: string | null;
  priority: "high" | "medium" | "low" | null;
  save_state: "saved" | "pending" | "error";
  save_state_detail: string | null;
  priority_inbox_item_id: string | null;
  native_source_link: string | null;
  priority_inbox_source_metadata: JsonRecord | null;
  task_category: {
    id: string;
    name: string;
    status: "active" | "inactive";
    is_fallback: boolean;
  } | null;
  linked_initiative: {
    id: string;
    title: string;
    status: string;
  } | null;
  origin_capture: {
    id: string;
    type: "note" | "task" | null;
    title: string | null;
    note_title: string | null;
    note_body: string | null;
    task_description: string | null;
  } | null;
  capture_updates: Array<{
    id: string;
    kind: "update" | "comment";
    body: string;
    created_at: string;
  }>;
  local_only: true;
};

export type LocalForwardedEmailDetailRecord = {
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
  parsed_headers: Record<string, string | null>;
  source_metadata: JsonRecord | null;
  created_at: string;
  updated_at: string;
};

type LocalPriorityInboxEventRecord = {
  id: string;
  itemId: string;
  userId: string;
  action: string;
  fromState: PriorityInboxVisibleState | null;
  toState: PriorityInboxVisibleState | null;
  disposition: PriorityInboxDisposition | null;
  dispositionReason: string | null;
  source: PriorityInboxItem["source"] | null;
  createdObject: PriorityInboxCreatedObject | null;
  metadata: JsonRecord;
  createdAt: string;
};

export type LocalPriorityInboxForwardingConfigRecord = {
  id: string;
  user_id: string;
  destination_address: string;
  source_metadata: JsonRecord | null;
};

type LocalPriorityInboxStore = {
  items: LocalPriorityInboxItemRecord[];
  libraryItems: LocalPriorityInboxLibraryRecord[];
  forwardedDetails: LocalForwardedEmailDetailRecord[];
  events: LocalPriorityInboxEventRecord[];
  forwardingConfigs: LocalPriorityInboxForwardingConfigRecord[];
};

const LOCAL_STORE_PATH =
  process.env.PRIORITY_INBOX_LOCAL_STORE_PATH?.trim() ||
  join(tmpdir(), "will-chief-of-staff-priority-inbox-dev.json");

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyStore(): LocalPriorityInboxStore {
  return {
    items: [],
    libraryItems: [],
    forwardedDetails: [],
    events: [],
    forwardingConfigs: []
  };
}

async function readStore() {
  try {
    const raw = await readFile(LOCAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalPriorityInboxStore>;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      libraryItems: Array.isArray(parsed.libraryItems) ? parsed.libraryItems : [],
      forwardedDetails: Array.isArray(parsed.forwardedDetails) ? parsed.forwardedDetails : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      forwardingConfigs: Array.isArray(parsed.forwardingConfigs) ? parsed.forwardingConfigs : []
    } satisfies LocalPriorityInboxStore;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
    if (code === "ENOENT") {
      return emptyStore();
    }

    return emptyStore();
  }
}

async function writeStore(store: LocalPriorityInboxStore) {
  await mkdir(dirname(LOCAL_STORE_PATH), { recursive: true });
  await writeFile(LOCAL_STORE_PATH, JSON.stringify(store, null, 2));
}

async function updateStore<T>(mutate: (store: LocalPriorityInboxStore) => T | Promise<T>) {
  const store = await readStore();
  const result = await mutate(store);
  await writeStore(store);
  return result;
}

function sortLocalItems(items: LocalPriorityInboxItemRecord[]) {
  items.sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return (right.item.lastChangedAt ?? "").localeCompare(left.item.lastChangedAt ?? "");
  });
}

function findLocalItemIndex(store: LocalPriorityInboxStore, userId: string, itemId: string) {
  return store.items.findIndex((record) => record.userId === userId && record.item.id === itemId);
}

function appendLocalEvent(
  store: LocalPriorityInboxStore,
  params: Omit<LocalPriorityInboxEventRecord, "id" | "createdAt">
) {
  store.events.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...params
  });
}

function buildSeedItemRecord(userId: string, item: PriorityInboxItem, sortOrder: number): LocalPriorityInboxItemRecord {
  const nowIso = new Date().toISOString();
  return {
    userId,
    sortOrder,
    createdAt: nowIso,
    updatedAt: nowIso,
    item: {
      ...cloneValue(item),
      lastChangedAt: item.lastChangedAt ?? nowIso
    }
  };
}

function takeExcerpt(value: string | null | undefined, limit: number) {
  const collapsed = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= limit) {
    return collapsed;
  }

  return `${collapsed.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function formatPriorityInboxSourceBlock(item: PriorityInboxItem) {
  return [
    `Priority Inbox item: ${item.primaryLine}`,
    `Priority Inbox id: ${item.id}`,
    `Native source: ${item.sourceLabel}`,
    `Ingestion mode: ${item.ingestionMode}`,
    item.externalMessageId ? `External message id: ${item.externalMessageId}` : null,
    item.conversationId ? `Conversation id: ${item.conversationId}` : null,
    item.sourceLink ? `Native link: ${item.sourceLink}` : "Native link: unavailable"
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function getPriorityInboxDetailFallbackHref(item: PriorityInboxItem) {
  return item.source === "forwarded_email" && !item.sourceLink ? `/inbox/${item.id}` : null;
}

function buildLocalPriorityInboxSourceMetadata(
  item: PriorityInboxItem,
  forwardedDetail?: LocalForwardedEmailDetailRecord | null
): JsonRecord {
  return {
    source: item.source,
    sourceLabel: item.sourceLabel,
    sourceFamily: item.sourceFamily,
    ingestionMode: item.ingestionMode,
    priorityInboxItemId: item.id,
    nativeSourceLink: item.sourceLink,
    fallbackDetailHref: getPriorityInboxDetailFallbackHref(item),
    sourceLink: item.sourceLink,
    externalMessageId: item.externalMessageId ?? null,
    conversationId: item.conversationId ?? null,
    receivedAt: item.receivedAt ?? null,
    sender: item.sender,
    senderRole: item.senderRole ?? null,
    threadTitle: item.threadTitle,
    primaryLine: item.primaryLine,
    summary: item.summary,
    forwardedEmailSource: forwardedDetail
      ? {
          id: forwardedDetail.id,
          destinationAddress: forwardedDetail.destination_address,
          forwardedByName: forwardedDetail.forwarded_by_name,
          forwardedByEmail: forwardedDetail.forwarded_by_email,
          originalSenderName: forwardedDetail.original_sender_name,
          originalSenderEmail: forwardedDetail.original_sender_email,
          originalSubject: forwardedDetail.original_subject,
          originalReceivedAt: forwardedDetail.original_received_at,
          forwardedAt: forwardedDetail.forwarded_at,
          providerHint: forwardedDetail.provider_hint,
          nativeSourceLink: forwardedDetail.native_source_link,
          detailBodyExcerpt: takeExcerpt(forwardedDetail.detail_body ?? forwardedDetail.raw_content, 2_000),
          attachmentNames: forwardedDetail.attachment_names ?? [],
          metadata: forwardedDetail.source_metadata ?? null
        }
      : null,
    metadata: {
      ...(item.sourceMetadata ?? {}),
      localOnly: true
    }
  };
}

function buildLocalPriorityInboxLibraryContent(
  item: PriorityInboxItem,
  contextNote: string | null | undefined,
  forwardedDetailBody?: string | null
) {
  const sections = [
    item.primaryLine.trim(),
    item.summary.trim(),
    contextNote?.trim() ? `Context:\n${contextNote.trim()}` : null,
    forwardedDetailBody?.trim() ? `Forwarded detail:\n${forwardedDetailBody.trim()}` : null,
    item.sensitiveContext?.trim() ? `Sensitive context:\n${item.sensitiveContext.trim()}` : null,
    `Source linkage:\n${formatPriorityInboxSourceBlock(item)}`
  ].filter((section): section is string => Boolean(section));

  return sections.join("\n\n");
}

function normalizeDueAt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createLibraryHref(captureId: string, type: "task" | "reference") {
  return type === "task"
    ? `/library/${captureId}?from=%2Flibrary%2Ftasks`
    : `/library/${captureId}?from=%2Flibrary`;
}

function createCommitmentHref(captureId: string) {
  return `/library/${captureId}?from=%2Fcommitments`;
}

function createLocalLibraryRecord(
  store: LocalPriorityInboxStore,
  params: {
    userId: string;
    item: PriorityInboxItem;
    disposition: PriorityInboxDisposition;
    payload: PriorityInboxTransitionPayload;
  }
) {
  const forwardedDetail =
    params.item.source === "forwarded_email"
      ? store.forwardedDetails.find(
          (detail) => detail.user_id === params.userId && detail.item_id === params.item.id
        ) ?? null
      : null;
  const forwardedDetailBody = takeExcerpt(
    forwardedDetail?.detail_body ?? forwardedDetail?.raw_content,
    2_000
  );
  const nowIso = new Date().toISOString();

  if (params.disposition === "task_created" && params.payload.canonicalTask) {
    const description = params.payload.canonicalTask.description.trim();
    if (!description) {
      return null;
    }

    const content = buildLocalPriorityInboxLibraryContent(
      params.item,
      [params.payload.canonicalTask.nextStep?.trim() ?? "", params.payload.canonicalTask.desiredOutcome?.trim() ?? ""]
        .filter(Boolean)
        .join("\n"),
      forwardedDetailBody
    );
    const record: LocalPriorityInboxLibraryRecord = {
      id: randomUUID(),
      user_id: params.userId,
      source_path: "/inbox",
      pattern: "task",
      privacy: params.item.sensitiveContext ? "hybrid" : "open",
      summary: description,
      follow_up:
        [params.payload.canonicalTask.nextStep?.trim() ?? "", params.payload.canonicalTask.desiredOutcome?.trim() ?? ""]
          .filter(Boolean)
          .join("\n\n") || params.item.summary,
      private_context: params.item.sensitiveContext ?? null,
      type: "task",
      title: description,
      note_title: null,
      note_body: null,
      task_description: description,
      task_next_step: params.payload.canonicalTask.nextStep?.trim() || null,
      task_desired_outcome: params.payload.canonicalTask.desiredOutcome?.trim() || null,
      task_category_id: params.payload.canonicalTask.categoryId ?? "local-tbd",
      linked_initiative_id: params.payload.canonicalTask.linkedInitiativeId ?? null,
      origin_capture_id: null,
      origin_type: "email",
      original_content: content,
      working_content: content,
      captured_at: nowIso,
      last_active_at: nowIso,
      archived_at: null,
      completed_at: null,
      deleted_at: null,
      due_at: null,
      priority: params.payload.canonicalTask.priority ?? "medium",
      save_state: "saved",
      save_state_detail: "Saved to the local dev fallback while Supabase is blocked.",
      priority_inbox_item_id: params.item.id,
      native_source_link: params.item.sourceLink ?? null,
      priority_inbox_source_metadata: buildLocalPriorityInboxSourceMetadata(params.item, forwardedDetail),
      task_category: {
        id: params.payload.canonicalTask.categoryId ?? "local-tbd",
        name: "TBD",
        status: "active",
        is_fallback: true
      },
      linked_initiative: null,
      origin_capture: null,
      capture_updates: [],
      local_only: true
    };
    store.libraryItems.push(record);

    return {
      record,
      createdObject: {
        id: record.id,
        type: "task",
        title: record.title,
        href: createLibraryHref(record.id, "task")
      } satisfies PriorityInboxCreatedObject
    };
  }

  if (params.disposition === "reference_saved" && params.payload.canonicalReference) {
    const title = params.payload.canonicalReference.title.trim();
    if (!title) {
      return null;
    }

    const content = buildLocalPriorityInboxLibraryContent(
      params.item,
      params.payload.canonicalReference.summary,
      forwardedDetailBody
    );
    const record: LocalPriorityInboxLibraryRecord = {
      id: randomUUID(),
      user_id: params.userId,
      source_path: "/inbox",
      pattern: "note",
      privacy: params.item.sensitiveContext ? "hybrid" : "open",
      summary: params.payload.canonicalReference.summary.trim() || params.item.summary,
      follow_up: null,
      private_context: params.item.sensitiveContext ?? null,
      type: "note",
      title,
      note_title: title,
      note_body: params.payload.canonicalReference.summary.trim() || params.item.summary,
      task_description: null,
      task_next_step: null,
      task_desired_outcome: null,
      task_category_id: null,
      linked_initiative_id: null,
      origin_capture_id: null,
      origin_type: "email",
      original_content: content,
      working_content: content,
      captured_at: nowIso,
      last_active_at: nowIso,
      archived_at: null,
      completed_at: null,
      deleted_at: null,
      due_at: null,
      priority: null,
      save_state: "saved",
      save_state_detail: "Saved to the local dev fallback while Supabase is blocked.",
      priority_inbox_item_id: params.item.id,
      native_source_link: params.item.sourceLink ?? null,
      priority_inbox_source_metadata: buildLocalPriorityInboxSourceMetadata(params.item, forwardedDetail),
      task_category: null,
      linked_initiative: null,
      origin_capture: null,
      capture_updates: [],
      local_only: true
    };
    store.libraryItems.push(record);

    return {
      record,
      createdObject: {
        id: record.id,
        type: "reference",
        title: record.title,
        href: createLibraryHref(record.id, "reference")
      } satisfies PriorityInboxCreatedObject
    };
  }

  if (params.disposition === "commitment_created" && params.payload.canonicalCommitment) {
    const title = params.payload.canonicalCommitment.statement.trim();
    if (!title) {
      return null;
    }

    const contextLines = [
      params.payload.canonicalCommitment.contextNote?.trim() || null,
      params.payload.canonicalCommitment.owedTo.trim()
        ? `Owed to: ${params.payload.canonicalCommitment.owedTo.trim()}`
        : null,
      params.payload.canonicalCommitment.dueLabel?.trim()
        ? `Timing note: ${params.payload.canonicalCommitment.dueLabel.trim()}`
        : null
    ].filter((line): line is string => Boolean(line));
    const content = buildLocalPriorityInboxLibraryContent(params.item, contextLines.join("\n"), forwardedDetailBody);
    const record: LocalPriorityInboxLibraryRecord = {
      id: randomUUID(),
      user_id: params.userId,
      source_path: "/commitments",
      pattern: "task",
      privacy: params.item.sensitiveContext ? "hybrid" : "open",
      summary: title,
      follow_up: contextLines.join("\n") || params.item.summary,
      private_context: params.item.sensitiveContext ?? null,
      type: "task",
      title,
      note_title: null,
      note_body: null,
      task_description: title,
      task_next_step: params.payload.canonicalCommitment.contextNote?.trim() || null,
      task_desired_outcome: null,
      task_category_id: "local-tbd",
      linked_initiative_id: null,
      origin_capture_id: null,
      origin_type: "email",
      original_content: content,
      working_content: content,
      captured_at: nowIso,
      last_active_at: nowIso,
      archived_at: null,
      completed_at: null,
      deleted_at: null,
      due_at: normalizeDueAt(params.payload.canonicalCommitment.dueAt),
      priority: "medium",
      save_state: "saved",
      save_state_detail: "Saved to the local dev fallback while Supabase is blocked.",
      priority_inbox_item_id: params.item.id,
      native_source_link: params.item.sourceLink ?? null,
      priority_inbox_source_metadata: buildLocalPriorityInboxSourceMetadata(params.item, forwardedDetail),
      task_category: {
        id: "local-tbd",
        name: "TBD",
        status: "active",
        is_fallback: true
      },
      linked_initiative: null,
      origin_capture: null,
      capture_updates: [],
      local_only: true
    };
    store.libraryItems.push(record);

    return {
      record,
      createdObject: {
        id: record.id,
        type: "commitment",
        title: record.title,
        href: createCommitmentHref(record.id)
      } satisfies PriorityInboxCreatedObject
    };
  }

  return null;
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

function upsertSourceCandidatesInStore(
  store: LocalPriorityInboxStore,
  params: {
    userId: string;
    candidates: PriorityInboxSourceCandidate[];
  }
) {
  const records = store.items.filter((record) => record.userId === params.userId);
  const existingByExternalId = new Map(
    records
      .filter((record) => record.item.externalMessageId)
      .map((record) => [record.item.externalMessageId ?? "", record] as const)
  );
  const nowIso = new Date().toISOString();

  return params.candidates.map((candidate, index) => {
    const existing = existingByExternalId.get(candidate.externalMessageId);
    const nextItem: PriorityInboxItem = {
      id: existing?.item.id ?? randomUUID(),
      source: candidate.source,
      sourceLabel: candidate.sourceLabel,
      sourceFamily: candidate.sourceFamily,
      ingestionMode: candidate.ingestionMode ?? (candidate.source === "forwarded_email" ? "forwarded" : "live_adapter"),
      sourceLink: candidate.sourceLink,
      externalMessageId: candidate.externalMessageId,
      conversationId: candidate.conversationId ?? null,
      receivedAt: candidate.receivedAt,
      sender: candidate.sender,
      senderRole: candidate.senderRole ?? undefined,
      threadTitle: candidate.subject,
      primaryLine: candidate.primaryLine,
      summary: candidate.snippet,
      timeLabel: formatPriorityInboxTimestamp(candidate.receivedAt),
      visibleState: existing?.item.visibleState ?? candidate.visibleState,
      priorVisibleState: existing?.item.priorVisibleState ?? candidate.visibleState,
      deferredUntil: existing?.item.deferredUntil ?? null,
      deferredLabel: existing?.item.deferredLabel ?? null,
      deferredReason: existing?.item.deferredReason ?? null,
      disposition: existing?.item.disposition ?? null,
      dispositionReason: existing?.item.dispositionReason ?? candidate.dispositionReason ?? null,
      dispositionLabel: existing?.item.dispositionLabel ?? null,
      updatedCue: candidate.updatedCue ?? existing?.item.updatedCue ?? null,
      relationshipCue: candidate.relationshipCue ?? existing?.item.relationshipCue ?? null,
      sensitiveContext: candidate.sensitiveContext ?? existing?.item.sensitiveContext ?? null,
      attachmentCue: candidate.attachmentCue ?? existing?.item.attachmentCue ?? null,
      groupedCue: candidate.groupedCue ?? existing?.item.groupedCue ?? null,
      whySurfaced: candidate.whySurfaced,
      supportingSignals: cloneValue(candidate.supportingSignals),
      recommendedAction: candidate.recommendedAction,
      taskPrefill: candidate.taskPrefill ? cloneValue(candidate.taskPrefill) : existing?.item.taskPrefill,
      commitmentPrefill: candidate.commitmentPrefill
        ? cloneValue(candidate.commitmentPrefill)
        : existing?.item.commitmentPrefill,
      initiativePrefill: candidate.initiativePrefill
        ? cloneValue(candidate.initiativePrefill)
        : existing?.item.initiativePrefill,
      referencePrefill: candidate.referencePrefill
        ? cloneValue(candidate.referencePrefill)
        : existing?.item.referencePrefill,
      createdObject: existing?.item.createdObject ?? null,
      lastChangedAt: existing?.item.lastChangedAt ?? nowIso,
      sourceMetadata: candidate.sourceMetadata ? cloneValue(candidate.sourceMetadata) : existing?.item.sourceMetadata ?? null
    };

    if (existing) {
      existing.item = nextItem;
      existing.updatedAt = nowIso;
      return existing;
    }

    const record: LocalPriorityInboxItemRecord = {
      userId: params.userId,
      sortOrder: -1000 + index,
      createdAt: nowIso,
      updatedAt: nowIso,
      item: nextItem
    };
    store.items.push(record);
    return record;
  });
}

export async function ensureLocalPriorityInboxSeedItems(userId: string) {
  await updateStore((store) => {
    const existing = store.items.filter((record) => record.userId === userId);
    if (existing.length > 0) {
      return;
    }

    seedPriorityInboxItems.forEach((item, index) => {
      const record = buildSeedItemRecord(userId, item, index);
      store.items.push(record);
      appendLocalEvent(store, {
        itemId: record.item.id,
        userId,
        action: "seeded",
        fromState: null,
        toState: record.item.visibleState,
        disposition: null,
        dispositionReason: null,
        source: record.item.source,
        createdObject: null,
        metadata: {
          seedId: item.id
        }
      });
    });
  });
}

export async function listLocalPriorityInboxItems(userId: string) {
  return await updateStore((store) => {
    const records = store.items.filter((record) => record.userId === userId);
    sortLocalItems(records);
    return records.map((record) => cloneValue(record.item));
  });
}

export async function deleteLocalPriorityInboxItem(userId: string, itemId: string): Promise<boolean> {
  return await updateStore((store) => {
    const index = findLocalItemIndex(store, userId, itemId);
    if (index === -1) {
      return false;
    }
    store.items.splice(index, 1);
    return true;
  });
}

export async function upsertLocalPriorityInboxSourceCandidates(params: {
  userId: string;
  candidates: PriorityInboxSourceCandidate[];
}) {
  return await updateStore((store) => {
    const upserted = upsertSourceCandidatesInStore(store, params);
    return upserted.map((record) => cloneValue(record.item));
  });
}

export async function ingestLocalForwardedPriorityInboxItem(params: {
  userId: string;
  destinationAddress: string;
  parsed: ParsedForwardedEmail;
  provider?: "cloudmailin" | "generic";
  providerMetadata?: JsonRecord;
}) {
  return await updateStore(async (store) => {
    const existing = store.items.find(
      (record) =>
        record.userId === params.userId &&
        record.item.source === "forwarded_email" &&
        record.item.externalMessageId === params.parsed.externalMessageId
    );
    const deduplicated = Boolean(existing);

    const [upsertedRecord] = upsertSourceCandidatesInStore(store, {
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
    const item = upsertedRecord?.item;

    if (!item) {
      throw new Error("Forwarded email could not be written to local Priority Inbox storage.");
    }

    const nowIso = new Date().toISOString();
    const detailIndex = store.forwardedDetails.findIndex((detail) => detail.item_id === item.id && detail.user_id === params.userId);
    const detailRecord: LocalForwardedEmailDetailRecord = {
      id: detailIndex >= 0 ? store.forwardedDetails[detailIndex]?.id ?? randomUUID() : randomUUID(),
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
      attachment_names: cloneValue(params.parsed.attachmentNames),
      parsed_headers: cloneValue(params.parsed.parsedHeaders),
      source_metadata: {
        ...(cloneValue(params.parsed.sourceMetadata) as JsonRecord),
        rawContentTruncated: params.parsed.rawContentTruncated
      },
      created_at: detailIndex >= 0 ? store.forwardedDetails[detailIndex]?.created_at ?? nowIso : nowIso,
      updated_at: nowIso
    };

    if (detailIndex >= 0) {
      store.forwardedDetails[detailIndex] = detailRecord;
    } else {
      store.forwardedDetails.push(detailRecord);
    }

    appendLocalEvent(store, {
      itemId: item.id,
      userId: params.userId,
      action: "inbound_received",
      fromState: null,
      toState: item.visibleState,
      disposition: null,
      dispositionReason: null,
      source: item.source,
      createdObject: null,
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
      item: cloneValue(item),
      deduplicated
    };
  });
}

export async function getLocalForwardedPriorityInboxItemDetail(userId: string, itemId: string) {
  return await updateStore((store) => {
    const itemRecord = store.items.find((record) => record.userId === userId && record.item.id === itemId);
    if (!itemRecord || itemRecord.item.source !== "forwarded_email") {
      return null;
    }

    const detail = store.forwardedDetails.find((record) => record.user_id === userId && record.item_id === itemId);
    if (!detail) {
      return null;
    }

    return {
      item: cloneValue(itemRecord.item),
      detail: cloneValue(detail)
    };
  });
}

export async function getLocalPriorityInboxItem(userId: string, itemId: string) {
  return await updateStore((store) => {
    const record = store.items.find((entry) => entry.userId === userId && entry.item.id === itemId);
    return record ? cloneValue(record.item) : null;
  });
}

export async function listLocalPriorityInboxLibraryItems(userId: string) {
  return await updateStore((store) =>
    store.libraryItems
      .filter((record) => record.user_id === userId && !record.deleted_at)
      .sort((left, right) => right.last_active_at.localeCompare(left.last_active_at))
      .map((record) => cloneValue(record))
  );
}

export async function getLocalPriorityInboxLibraryItem(userId: string, itemId: string) {
  return await updateStore((store) => {
    const record = store.libraryItems.find(
      (entry) => entry.user_id === userId && entry.id === itemId && !entry.deleted_at
    );
    return record ? cloneValue(record) : null;
  });
}

export async function resetLocalPriorityInboxData(userId: string) {
  return await updateStore((store) => {
    store.items = store.items.filter((record) => record.userId !== userId);
    store.libraryItems = store.libraryItems.filter((record) => record.user_id !== userId);
    store.forwardedDetails = store.forwardedDetails.filter((record) => record.user_id !== userId);
    store.events = store.events.filter((record) => record.userId !== userId);
    store.forwardingConfigs = store.forwardingConfigs.filter((record) => record.user_id !== userId);
    return {
      ok: true
    };
  });
}

export async function addLocalManualPriorityInboxItem(userId: string, input: PriorityInboxManualAddInput) {
  return await updateStore((store) => {
    const nowIso = new Date().toISOString();
    const deferredTimestamp =
      input.visibleState === "deferred" && input.deferredUntil ? new Date(input.deferredUntil).toISOString() : null;
    const item: PriorityInboxItem = {
      id: randomUUID(),
      source: "manual",
      sourceLabel: "Manual / Capture",
      sourceFamily: "manual",
      ingestionMode: "manual",
      sourceLink: input.sourceLink,
      sender: input.sender,
      threadTitle: input.threadTitle,
      primaryLine: input.primaryLine,
      summary: input.summary,
      timeLabel: "Added just now",
      visibleState: input.visibleState,
      priorVisibleState: input.visibleState === "high_priority" ? "high_priority" : "needs_review",
      deferredUntil: deferredTimestamp,
      deferredLabel: deferredTimestamp ? formatPriorityInboxTimestamp(deferredTimestamp) : null,
      deferredReason: deferredTimestamp ? "not_now" : null,
      whySurfaced: input.whySurfaced,
      supportingSignals: ["Manual routing signal"],
      recommendedAction: input.visibleState === "high_priority" ? "create_task" : "save_reference",
      sensitiveContext: input.sensitiveContext ?? null,
      referencePrefill: {
        title: input.threadTitle,
        summary: input.summary
      },
      createdObject: null,
      lastChangedAt: nowIso,
      sourceMetadata: {
        localOnly: true
      }
    };

    const sortOrder = Math.min(0, ...store.items.filter((record) => record.userId === userId).map((record) => record.sortOrder)) - 1;
    store.items.push({
      userId,
      sortOrder,
      createdAt: nowIso,
      updatedAt: nowIso,
      item
    });

    appendLocalEvent(store, {
      itemId: item.id,
      userId,
      action: "manual_add",
      fromState: null,
      toState: item.visibleState,
      disposition: null,
      dispositionReason: null,
      source: item.source,
      createdObject: null,
      metadata: {
        sourceLink: input.sourceLink
      }
    });

    return cloneValue(item);
  });
}

export async function openLocalPriorityInboxSource(userId: string, itemId: string) {
  return await updateStore((store) => {
    const item = store.items.find((record) => record.userId === userId && record.item.id === itemId)?.item;
    if (!item) {
      return null;
    }

    appendLocalEvent(store, {
      itemId,
      userId,
      action: "source_opened",
      fromState: item.visibleState,
      toState: item.visibleState,
      disposition: "source_opened",
      dispositionReason: null,
      source: item.source,
      createdObject: null,
      metadata: {}
    });

    return cloneValue(item);
  });
}

export async function transitionLocalPriorityInboxItem(params: {
  userId: string;
  itemId: string;
  payload: PriorityInboxTransitionPayload;
}) {
  return await updateStore((store) => {
    const index = findLocalItemIndex(store, params.userId, params.itemId);
    if (index < 0) {
      return null;
    }

    const record = store.items[index];
    const item = record.item;
    const priorVisibleState =
      item.visibleState === "high_priority" || item.visibleState === "needs_review"
        ? item.visibleState
        : (item.priorVisibleState ?? "needs_review");
    const localLibraryResult = createLocalLibraryRecord(store, {
      userId: params.userId,
      item,
      disposition: params.payload.disposition,
      payload: params.payload
    });
    const createdObject = localLibraryResult?.createdObject ?? params.payload.createdObject ?? null;
    const nowIso = new Date().toISOString();

    record.item = {
      ...item,
      visibleState: params.payload.nextState,
      priorVisibleState,
      deferredUntil: params.payload.nextState === "deferred" ? params.payload.deferredUntil ?? null : null,
      deferredLabel: params.payload.nextState === "deferred" ? params.payload.deferredLabel ?? null : null,
      deferredReason: params.payload.nextState === "deferred" ? params.payload.deferredReason ?? null : null,
      disposition: params.payload.disposition,
      dispositionReason: params.payload.dispositionReason ?? null,
      dispositionLabel: params.payload.dispositionLabel,
      createdObject,
      updatedCue: null,
      timeLabel: timeLabelForVisibleState(params.payload.nextState, params.payload.deferredLabel),
      lastChangedAt: nowIso,
      sourceMetadata: {
        ...(item.sourceMetadata ?? {}),
        localOnly: true
      }
    };
    record.updatedAt = nowIso;

    appendLocalEvent(store, {
      itemId: params.itemId,
      userId: params.userId,
      action: "transition",
      fromState: item.visibleState,
      toState: params.payload.nextState,
      disposition: params.payload.disposition,
      dispositionReason:
        params.payload.nextState === "deferred"
          ? (params.payload.deferredReason ?? null)
          : (params.payload.dispositionReason ?? null),
      source: item.source,
      createdObject,
      metadata:
        params.payload.nextState === "deferred"
          ? {
              deferredUntil: params.payload.deferredUntil ?? null,
              deferredLabel: params.payload.deferredLabel ?? null,
              deferredReason: params.payload.deferredReason ?? null
            }
          : createdObject
            ? {
                createdObject,
                localLibraryItemId: localLibraryResult?.record.id ?? null
              }
            : {}
    });

    return cloneValue(record.item);
  });
}

export async function updateLocalPriorityInboxVisibleState(params: {
  userId: string;
  itemId: string;
  nextState: Extract<PriorityInboxVisibleState, "high_priority" | "needs_review">;
  action: "promoted" | "demoted" | "restored";
  timeLabel: string;
  updatedCue: string;
}) {
  return await updateStore((store) => {
    const index = findLocalItemIndex(store, params.userId, params.itemId);
    if (index < 0) {
      return null;
    }

    const record = store.items[index];
    const previous = cloneValue(record.item);
    const nowIso = new Date().toISOString();

    record.item = {
      ...record.item,
      visibleState: params.nextState,
      priorVisibleState: params.nextState,
      deferredUntil: null,
      deferredLabel: null,
      deferredReason: null,
      disposition: null,
      dispositionReason: null,
      dispositionLabel: null,
      updatedCue: params.updatedCue,
      timeLabel: params.timeLabel,
      lastChangedAt: nowIso
    };
    record.updatedAt = nowIso;

    appendLocalEvent(store, {
      itemId: params.itemId,
      userId: params.userId,
      action: params.action,
      fromState: previous.visibleState,
      toState: params.nextState,
      disposition: null,
      dispositionReason: null,
      source: previous.source,
      createdObject: null,
      metadata: {}
    });

    return cloneValue(record.item);
  });
}

export async function getLocalPriorityInboxForwardingConfig(params: {
  userId: string;
  defaultAddress: string | null;
}) {
  return await updateStore((store) => {
    const existing = store.forwardingConfigs.find((record) => record.user_id === params.userId);
    if (existing) {
      return cloneValue(existing);
    }

    if (!params.defaultAddress) {
      return null;
    }

    const created: LocalPriorityInboxForwardingConfigRecord = {
      id: randomUUID(),
      user_id: params.userId,
      destination_address: params.defaultAddress.toLowerCase(),
      source_metadata: {
        origin: "default",
        localOnly: true
      }
    };
    store.forwardingConfigs.push(created);
    return cloneValue(created);
  });
}

export async function updateLocalPriorityInboxForwardingConfig(userId: string, destinationAddress: string) {
  return await updateStore((store) => {
    const normalized = destinationAddress.toLowerCase();
    const existingIndex = store.forwardingConfigs.findIndex((record) => record.user_id === userId);
    const nextRecord: LocalPriorityInboxForwardingConfigRecord = {
      id: existingIndex >= 0 ? store.forwardingConfigs[existingIndex]?.id ?? randomUUID() : randomUUID(),
      user_id: userId,
      destination_address: normalized,
      source_metadata: {
        origin: "manual",
        localOnly: true
      }
    };

    if (existingIndex >= 0) {
      store.forwardingConfigs[existingIndex] = nextRecord;
    } else {
      store.forwardingConfigs.push(nextRecord);
    }

    return cloneValue(nextRecord);
  });
}

export async function resolveLocalPriorityInboxForwardingUserByDestination(destinationAddress: string) {
  return await updateStore((store) => {
    const normalized = destinationAddress.trim().toLowerCase();
    const record = store.forwardingConfigs.find((entry) => entry.destination_address === normalized);
    return record ? cloneValue(record) : null;
  });
}
