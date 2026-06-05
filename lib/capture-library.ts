import type {
  PriorityInboxCanonicalCommitmentInput,
  PriorityInboxCanonicalReferenceInput,
  PriorityInboxCanonicalTaskInput,
  PriorityInboxItem
} from "@/lib/priority-inbox";
import {
  buildNoteWorkingContent,
  buildTaskWorkingContent,
  computeNoteDisplayTitle,
  computeTaskDisplayTitle,
  formatTaskPriorityLabel,
  getExecutiveCaptureTypeLabel,
  isExecutiveCaptureType,
  isTaskPriority,
  type ExecutiveCaptureMetadata,
  type ExecutiveCaptureType,
  type TaskFields,
  type TaskPriority
} from "@/lib/blackhawk-capture-model";
import type { ExecutiveWorkType } from "@/lib/executive-work";
import {
  compareLibraryItemsForExecutiveView,
  filterLibraryItems,
  parseLibraryQueryParams
} from "@/lib/library-filters";
import {
  mergeExecutiveCaptureMetadata,
  resolveLibraryItemEditorMode,
  type LibraryItemEditorMode
} from "@/lib/library-executive-edit";
import {
  getLocalPriorityInboxLibraryItem,
  listLocalPriorityInboxLibraryItems,
  type LocalPriorityInboxLibraryRecord
} from "@/lib/priority-inbox-local-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import { execFile } from "node:child_process";

export type LibraryItemType = "note" | "task";
export type LibraryItemStatus = "active" | "completed" | "archived";
export type CaptureUpdateKind = "update" | "comment";
export type CaptureSaveState = "saved" | "pending" | "error";
export type LibraryScope = "library" | "tasks" | "archived";
export type LibraryBrowseMode = "all" | "notes" | "tasks";
export type LibraryTypeFilter = "all" | ExecutiveCaptureType;
export type LibraryStatusFilter = "all" | LibraryItemStatus;
export type LibraryDueFilter = "all" | "overdue" | "upcoming" | "none";
export type LibraryTaskStatus = "active" | "completed";
export type LibraryTaskPriority = "low" | "medium" | "high";
export type LibraryPriorityFilter = "all" | LibraryTaskPriority;
export type LibraryTaskCategoryFilter = "all" | string;
export type LibraryQuickView =
  | "high-priority"
  | "waiting-on"
  | "decisions"
  | "opportunities"
  | "meeting-notes"
  | "needs-cleanup"
  | "recently-archived";
export {
  LIBRARY_WORK_TYPE_ORDER,
  LIBRARY_QUICK_VIEWS,
  countLibraryItemsForQuickView,
  countLibraryItemsByWorkType,
  getLibraryCaptureType,
  getLibraryQuickViewDefinition,
  getLibraryItemPriority,
  groupLibraryItemsByWorkType
} from "@/lib/library-filters";
type JsonRecord = Record<string, unknown>;
type CaptureLibraryDbClient =
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>
  | NonNullable<NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>>["client"]>;

type ForwardedEmailSourceCaptureRow = {
  id: string;
  destination_address: string;
  forwarded_by_name: string | null;
  forwarded_by_email: string | null;
  original_sender_name: string | null;
  original_sender_email: string | null;
  original_subject: string | null;
  original_received_at: string | null;
  forwarded_at: string | null;
  provider_hint: "outlook" | "gmail" | null;
  native_source_link: string | null;
  detail_body: string | null;
  raw_content: string;
  attachment_names: string[] | null;
  source_metadata: unknown;
};

type PriorityInboxSourceLinkage = {
  priorityInboxItemId: string;
  source: string;
  sourceLabel: string | null;
  sourceFamily: string | null;
  ingestionMode: string | null;
  nativeSourceLink: string | null;
  fallbackDetailHref: string | null;
  externalMessageId: string | null;
  conversationId: string | null;
  receivedAt: string | null;
  sender: string | null;
  senderRole: string | null;
  threadTitle: string | null;
  primaryLine: string | null;
  summary: string | null;
  metadata: JsonRecord | null;
  forwardedEmailSource: {
    id: string;
    destinationAddress: string;
    forwardedByName: string | null;
    forwardedByEmail: string | null;
    originalSenderName: string | null;
    originalSenderEmail: string | null;
    originalSubject: string | null;
    originalReceivedAt: string | null;
    forwardedAt: string | null;
    providerHint: "outlook" | "gmail" | null;
    nativeSourceLink: string | null;
    detailBodyExcerpt: string | null;
    attachmentNames: string[];
    metadata: JsonRecord | null;
  } | null;
};

type CaptureTaskCategoryRow = {
  id: string;
  name: string;
  status: "active" | "inactive";
  is_fallback: boolean;
};

type CaptureInitiativeRow = {
  id: string;
  title: string;
  status: string;
};

type RelatedCaptureRow = {
  id: string;
  type: LibraryItemType | null;
  title: string | null;
  note_title: string | null;
  note_body: string | null;
  task_description: string | null;
};

type CaptureUpdateRow = {
  id: string;
  kind: CaptureUpdateKind;
  body: string;
  created_at: string;
};

type CaptureRow = {
  id: string;
  source_path: string | null;
  pattern: LibraryItemType;
  privacy: "open" | "protected" | "hybrid";
  summary: string;
  follow_up: string | null;
  private_context: string | null;
  type: LibraryItemType | null;
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
  priority?: LibraryTaskPriority | null;
  executive_work_type?: ExecutiveWorkType | null;
  capture_metadata?: ExecutiveCaptureMetadata | null;
  save_state: CaptureSaveState;
  save_state_detail: string | null;
  priority_inbox_item_id?: string | null;
  native_source_link?: string | null;
  priority_inbox_source_metadata?: unknown;
  task_category?: CaptureTaskCategoryRow | null;
  linked_initiative?: CaptureInitiativeRow | null;
  origin_capture?: RelatedCaptureRow | null;
  capture_updates?: CaptureUpdateRow[] | null;
};

type CaptureLibraryQueryError = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

const TRANSIENT_SUPABASE_RETRY_COUNT = 2;
const TRANSIENT_SUPABASE_RETRY_DELAY_MS = 350;

type OwnedCaptureRow = {
  id: string;
  user_id: string;
  source_path: string | null;
  privacy: "open" | "protected" | "hybrid";
  private_context: string | null;
  type: LibraryItemType | null;
  title: string;
  note_title: string | null;
  note_body: string | null;
  task_description: string | null;
  task_next_step: string | null;
  task_desired_outcome: string | null;
  task_category_id: string | null;
  linked_initiative_id: string | null;
  due_at: string | null;
  priority: LibraryTaskPriority | null;
  executive_work_type: ExecutiveWorkType | null;
  capture_metadata: ExecutiveCaptureMetadata | null;
  archived_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
};

export type CaptureUpdateEntry = {
  id: string;
  kind: CaptureUpdateKind;
  body: string;
  createdAt: string;
};

export type LibraryTaskData = {
  title: string;
  description: string;
  nextStep: string;
  desiredOutcome: string;
  status: LibraryTaskStatus;
  dueAt: string | null;
  priority: LibraryTaskPriority | null;
  categoryId: string | null;
  categoryName: string;
  categoryIsFallback: boolean;
  linkedInitiativeId: string | null;
  linkedInitiativeTitle: string | null;
};

export type LibraryNoteData = {
  title: string;
  body: string;
  linkedInitiativeId: string | null;
  linkedInitiativeTitle: string | null;
};

export type LibraryItemSummary = {
  id: string;
  type: LibraryItemType;
  captureType: ExecutiveCaptureType;
  captureTypeLabel: string;
  executiveWorkType: ExecutiveWorkType | null;
  captureMetadata: ExecutiveCaptureMetadata | null;
  priority?: LibraryTaskPriority | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categoryIsFallback?: boolean;
  linkedInitiativeId?: string | null;
  linkedInitiativeTitle?: string | null;
  title: string;
  preview: string;
  sourcePath: string | null;
  privacy: "open" | "protected" | "hybrid";
  status: LibraryItemStatus;
  capturedAt: string;
  lastActiveAt: string;
  archivedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  saveState: CaptureSaveState;
  saveStateDetail: string;
  localOnly: boolean;
  note: LibraryNoteData | null;
  task: LibraryTaskData | null;
  originCapture:
    | {
        id: string;
        type: LibraryItemType;
        title: string;
      }
    | null;
  sourceLinkage: PriorityInboxSourceLinkage | null;
};

export type LibraryItemDetail = LibraryItemSummary & {
  originalContent: string;
  workingContent: string;
  updates: CaptureUpdateEntry[];
};

export type LibraryWorkTypeSummary = {
  type: ExecutiveCaptureType;
  label: string;
  count: number;
};

export type LibraryWorkTypeGroup = {
  type: ExecutiveCaptureType;
  label: string;
  items: LibraryItemSummary[];
};

export type LibraryQuery = {
  scope: LibraryScope;
  mode: LibraryBrowseMode;
  view: LibraryQuickView | null;
  search: string;
  type: LibraryTypeFilter;
  status: LibraryStatusFilter;
  priority: LibraryPriorityFilter;
  due: LibraryDueFilter;
  category: LibraryTaskCategoryFilter;
};

export type LibraryMutationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type PriorityInboxLibraryLinkResult =
  | {
      ok: true;
      object: {
        type: "task" | "commitment" | "reference";
        title: string;
        href: string;
        captureId: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

const CAPTURE_LIBRARY_SELECT = `
  id,
  source_path,
  pattern,
  privacy,
  summary,
  follow_up,
  private_context,
  type,
  title,
  note_title,
  note_body,
  task_description,
  task_next_step,
  task_desired_outcome,
  task_category_id,
  linked_initiative_id,
  origin_capture_id,
  origin_type,
  original_content,
  working_content,
  captured_at,
  last_active_at,
  archived_at,
  completed_at,
  deleted_at,
  due_at,
  priority,
  executive_work_type,
  capture_metadata,
  save_state,
  save_state_detail,
  priority_inbox_item_id,
  native_source_link,
  priority_inbox_source_metadata,
  task_category:task_categories (
    id,
    name,
    status,
    is_fallback
  ),
  linked_initiative:initiatives (
    id,
    title,
    status
  ),
  origin_capture:captures!origin_capture_id (
    id,
    type,
    title,
    note_title,
    note_body,
    task_description
  ),
  capture_updates (
    id,
    kind,
    body,
    created_at
  )
`;

const CAPTURE_LIBRARY_CURL_SELECT = [
  "id",
  "source_path",
  "pattern",
  "privacy",
  "summary",
  "follow_up",
  "private_context",
  "type",
  "title",
  "note_title",
  "note_body",
  "task_description",
  "task_next_step",
  "task_desired_outcome",
  "task_category_id",
  "linked_initiative_id",
  "origin_capture_id",
  "origin_type",
  "original_content",
  "working_content",
  "captured_at",
  "last_active_at",
  "archived_at",
  "completed_at",
  "deleted_at",
  "due_at",
  "priority",
  "executive_work_type",
  "capture_metadata",
  "save_state",
  "save_state_detail",
  "priority_inbox_item_id",
  "native_source_link",
  "priority_inbox_source_metadata"
].join(",");

const PRIORITY_INBOX_BODY_EXCERPT_LIMIT = 2_000;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapJsonRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function mapExecutiveCaptureMetadata(value: unknown): ExecutiveCaptureMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const captureType = typeof value.captureType === "string" ? value.captureType : null;
  if (!isExecutiveCaptureType(captureType)) {
    return null;
  }

  return value as ExecutiveCaptureMetadata;
}

function resolveOwnedCaptureEditorMode(
  capture: Pick<OwnedCaptureRow, "type" | "executive_work_type" | "capture_metadata">
): LibraryItemEditorMode {
  return resolveLibraryItemEditorMode({
    type: capture.type ?? "note",
    captureType: mapExecutiveCaptureMetadata(capture.capture_metadata)?.captureType ?? null,
    executiveWorkType: capture.executive_work_type
  });
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function firstNonEmptyText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function formatWorkingContentSection(label: string, value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? `${label}:\n${trimmed}` : null;
}

function buildExecutiveNoteWorkingContent(input: {
  captureType: "decision" | "opportunity" | "meeting_note";
  title: string;
  body: string | null;
  metadata: ExecutiveCaptureMetadata;
  linkedInitiativeTitle?: string | null;
  dueAt?: string | null;
  priority?: LibraryTaskPriority | null;
}) {
  const sections =
    input.captureType === "decision"
      ? [
          formatWorkingContentSection("Decision Question", input.metadata.decisionQuestion ?? input.title),
          formatWorkingContentSection("Recommendation", input.metadata.recommendation),
          formatWorkingContentSection("Options / Tradeoffs", input.metadata.optionsTradeoffs),
          formatWorkingContentSection("Risks", input.metadata.risks),
          formatWorkingContentSection("People Involved", input.metadata.peopleInvolved),
          formatWorkingContentSection("Status", input.metadata.status),
          formatWorkingContentSection("Deadline", input.dueAt ?? input.metadata.deadline),
          formatWorkingContentSection("Linked Initiative", input.linkedInitiativeTitle),
          formatWorkingContentSection("Context", input.body)
        ]
      : input.captureType === "opportunity"
        ? [
            formatWorkingContentSection("Title", input.title),
            formatWorkingContentSection("Company / Counterparty", input.metadata.companyOrCounterparty),
            formatWorkingContentSection("Why It Matters", input.metadata.strategicRelevance),
            formatWorkingContentSection("Next Action", input.metadata.nextAction),
            formatWorkingContentSection("Owner", input.metadata.owner),
            formatWorkingContentSection("Status", input.metadata.status),
            formatWorkingContentSection("Related Company", input.metadata.relatedCompany),
            formatWorkingContentSection("Related Person", input.metadata.relatedPerson),
            formatWorkingContentSection("Priority", input.priority ? formatTaskPriorityLabel(input.priority) : null),
            formatWorkingContentSection("Linked Initiative", input.linkedInitiativeTitle),
            formatWorkingContentSection("Context", input.body)
          ]
        : [
            formatWorkingContentSection("Meeting Title", input.metadata.meetingTitle ?? input.title),
            formatWorkingContentSection("Meeting At", input.metadata.meetingAt),
            formatWorkingContentSection("Attendees", input.metadata.attendees),
            formatWorkingContentSection("Notes", input.body),
            formatWorkingContentSection("Decisions", input.metadata.decisions),
            formatWorkingContentSection("Follow Ups", input.metadata.followUps),
            formatWorkingContentSection("Waiting On", input.metadata.waitingOnItems),
            formatWorkingContentSection("Related Company", input.metadata.relatedCompany),
            formatWorkingContentSection("Related Person", input.metadata.relatedPerson),
            formatWorkingContentSection("Linked Initiative", input.linkedInitiativeTitle)
          ];

  return sections.filter((section): section is string => Boolean(section)).join("\n\n").trim();
}

function buildExecutiveTaskWorkingContent(input: {
  description: string;
  nextStep: string;
  desiredOutcome: string;
  priority: LibraryTaskPriority;
  categoryName: string | null;
  linkedInitiativeTitle: string | null;
  dueAt: string | null;
  metadata: ExecutiveCaptureMetadata;
}) {
  const sections = [
    buildTaskWorkingContent(
      {
        description: input.description,
        nextStep: input.nextStep,
        desiredOutcome: input.desiredOutcome,
        priority: input.priority,
        categoryId: null,
        linkedInitiativeId: null,
        dueAt: input.dueAt
      },
      {
        categoryName: input.categoryName,
        initiativeTitle: input.linkedInitiativeTitle
      }
    ),
    formatWorkingContentSection("Waiting On", input.metadata.waitingOn),
    formatWorkingContentSection("Expected Outcome", input.metadata.expectedOutcome),
    formatWorkingContentSection("Delegated To", input.metadata.delegatedTo),
    formatWorkingContentSection("Last Touch", input.metadata.lastTouch),
    formatWorkingContentSection("Related Opportunity", input.metadata.relatedOpportunity)
  ];

  return sections.filter((section): section is string => Boolean(section)).join("\n\n").trim();
}

function parseOptionalTaskPriority(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return {
      ok: true as const,
      value: null
    };
  }

  if (isTaskPriority(normalized)) {
    return {
      ok: true as const,
      value: normalized
    };
  }

  return {
    ok: false as const,
    error: "Task priority must be High, Medium, or Low."
  };
}

function logCaptureLibrary(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[capture.library]", message, details ?? {});
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function isLibraryTaskStatus(value: string | undefined): value is LibraryTaskStatus {
  return value === "active" || value === "completed";
}

function isLibraryTaskPriority(value: string | null | undefined): value is LibraryTaskPriority {
  return value === "low" || value === "medium" || value === "high";
}

function shouldRetryTransientSupabaseFailure(error: CaptureLibraryQueryError | null | undefined) {
  if (!error) {
    return false;
  }

  const errorText = `${error.message ?? ""}\n${error.details ?? ""}\n${error.hint ?? ""}`.toLowerCase();
  return (
    errorText.includes("fetch failed") ||
    errorText.includes("connect timeout") ||
    errorText.includes("und_err_connect_timeout") ||
    errorText.includes("enotfound") ||
    errorText.includes("getaddrinfo")
  );
}

function shouldUseCurlCaptureLibraryFallback(error: CaptureLibraryQueryError | null | undefined) {
  if (process.env.NODE_ENV === "production" || !error) {
    return false;
  }

  return shouldRetryTransientSupabaseFailure(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execFileAsync(file: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, args, { env: process.env }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runCaptureQueryWithRetries<T>(
  queryFactory: () => Promise<{ data: T | null; error: CaptureLibraryQueryError | null }>
) {
  let attempt = 0;
  let result = await queryFactory();

  while (result.error && shouldRetryTransientSupabaseFailure(result.error) && attempt < TRANSIENT_SUPABASE_RETRY_COUNT) {
    attempt += 1;
    await sleep(TRANSIENT_SUPABASE_RETRY_DELAY_MS);
    result = await queryFactory();
  }

  return result;
}

async function readCapturesViaCurlFallback(params: {
  userId: string;
  captureId?: string;
  archivedFilter?: "exclude" | "only" | "all";
  tasksOnly?: boolean;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    logCaptureLibrary("curl fallback could not start because Supabase env vars are missing.", {
      hasUrl: Boolean(url),
      hasApiKey: Boolean(apiKey)
    });
    return null;
  }

  const query = new URLSearchParams();
  query.set("select", CAPTURE_LIBRARY_CURL_SELECT);
  query.set("user_id", `eq.${params.userId}`);
  query.set("deleted_at", "is.null");
  query.set("order", "last_active_at.desc");

  if (params.captureId) {
    query.set("id", `eq.${params.captureId}`);
  }

  if (params.tasksOnly) {
    query.set("type", "eq.task");
  }

  if (params.archivedFilter === "exclude") {
    query.set("archived_at", "is.null");
  } else if (params.archivedFilter === "only") {
    query.set("archived_at", "not.is.null");
  }

  try {
    const { stdout, stderr } = await execFileAsync("curl", [
      "-sk",
      "-X",
      "GET",
      `${url}/rest/v1/captures?${query.toString()}`,
      "-H",
      `apikey: ${apiKey}`,
      "-H",
      `Authorization: Bearer ${apiKey}`
    ]);

    if (stderr.trim()) {
      logCaptureLibrary("curl fallback emitted stderr while reading captures.", {
        stderr: stderr.trim()
      });
    }

    return JSON.parse(stdout) as CaptureRow[];
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    logCaptureLibrary("curl fallback failed while reading captures.", {
      userId: params.userId,
      captureId: params.captureId ?? null,
      errorMessage: failure.message,
      stdout: failure.stdout ?? null,
      stderr: failure.stderr ?? null
    });
    return null;
  }
}

function mapRowType(row: Pick<CaptureRow, "type" | "pattern">): LibraryItemType {
  return row.type ?? row.pattern;
}

function mapRowCaptureType(
  row: Pick<CaptureRow, "type" | "pattern" | "capture_metadata">
): ExecutiveCaptureType {
  const captureType = mapExecutiveCaptureMetadata(row.capture_metadata)?.captureType ?? null;
  if (captureType) {
    return captureType;
  }

  return mapRowType(row);
}

function getTaskStatus(completedAt: string | null): LibraryTaskStatus {
  return completedAt ? "completed" : "active";
}

function getLibraryStatus(row: Pick<CaptureRow, "archived_at" | "completed_at" | "type" | "pattern">): LibraryItemStatus {
  if (row.archived_at) {
    return "archived";
  }

  if (mapRowType(row) === "task" && row.completed_at) {
    return "completed";
  }

  return "active";
}

function buildPreview(...values: Array<string | null | undefined>) {
  const source = values
    .map((value) => value?.trim() ?? "")
    .find(Boolean) ?? "";
  const collapsed = source.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return "No working content yet.";
  }

  if (collapsed.length <= 180) {
    return collapsed;
  }

  return `${collapsed.slice(0, 177).trimEnd()}...`;
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

function mapUpdateEntry(row: CaptureUpdateRow): CaptureUpdateEntry {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at
  };
}

function localLibraryRecordToCaptureRow(record: LocalPriorityInboxLibraryRecord): CaptureRow {
  return {
    id: record.id,
    source_path: record.source_path,
    pattern: record.pattern,
    privacy: record.privacy,
    summary: record.summary,
    follow_up: record.follow_up,
    private_context: record.private_context,
    type: record.type,
    title: record.title,
    note_title: record.note_title,
    note_body: record.note_body,
    task_description: record.task_description,
    task_next_step: record.task_next_step,
    task_desired_outcome: record.task_desired_outcome,
    task_category_id: record.task_category_id,
    linked_initiative_id: record.linked_initiative_id,
    origin_capture_id: record.origin_capture_id,
    origin_type: record.origin_type,
    original_content: record.original_content,
    working_content: record.working_content,
    captured_at: record.captured_at,
    last_active_at: record.last_active_at,
    archived_at: record.archived_at,
    completed_at: record.completed_at,
    deleted_at: record.deleted_at,
    due_at: record.due_at,
    priority: record.priority,
    executive_work_type: null,
    capture_metadata: null,
    save_state: record.save_state,
    save_state_detail: record.save_state_detail,
    priority_inbox_item_id: record.priority_inbox_item_id,
    native_source_link: record.native_source_link,
    priority_inbox_source_metadata: record.priority_inbox_source_metadata,
    task_category: record.task_category,
    linked_initiative: record.linked_initiative,
    origin_capture: record.origin_capture,
    capture_updates: record.capture_updates
  };
}

function displayTitleForOrigin(row: RelatedCaptureRow) {
  if ((row.type ?? "note") === "task") {
    return computeTaskDisplayTitle(row.task_description ?? row.title ?? "");
  }

  return computeNoteDisplayTitle(row.note_title ?? row.title ?? "", row.note_body ?? row.title ?? "");
}

function mapLibrarySummary(row: CaptureRow): LibraryItemSummary {
  const type = mapRowType(row);
  const captureType = mapRowCaptureType(row);
  const captureMetadata = mapExecutiveCaptureMetadata(row.capture_metadata);
  const status = getLibraryStatus(row);
  const saveStateDetail = row.save_state_detail ?? "";
  const priority = isLibraryTaskPriority(row.priority) ? row.priority : null;
  const noteTitle = computeNoteDisplayTitle(row.note_title ?? "", row.note_body ?? row.summary);
  const taskDescription = row.task_description?.trim() || row.summary.trim();
  const taskTitle = computeTaskDisplayTitle(taskDescription);
  const categoryName = row.task_category?.name ?? "TBD";
  const categoryIsFallback = row.task_category?.is_fallback ?? categoryName.trim().toLowerCase() === "tbd";
  const originCapture =
    row.origin_capture && row.origin_capture.id
      ? {
          id: row.origin_capture.id,
          type: row.origin_capture.type ?? "note",
          title: displayTitleForOrigin(row.origin_capture)
        }
      : null;

  return {
    id: row.id,
    type,
    captureType,
    captureTypeLabel: getExecutiveCaptureTypeLabel(captureType),
    executiveWorkType: row.executive_work_type ?? null,
    captureMetadata,
    priority,
    categoryId: row.task_category_id,
    categoryName: row.task_category?.name ?? null,
    categoryIsFallback: row.task_category ? row.task_category.is_fallback : undefined,
    linkedInitiativeId: row.linked_initiative_id,
    linkedInitiativeTitle: row.linked_initiative?.title ?? null,
    title: type === "task" ? taskTitle : noteTitle,
    preview:
      type === "task"
        ? buildPreview(row.task_next_step, row.task_desired_outcome, row.working_content, row.original_content)
        : buildPreview(row.note_body, row.working_content, row.original_content),
    sourcePath: row.source_path,
    privacy: row.privacy,
    status,
    capturedAt: row.captured_at,
    lastActiveAt: row.last_active_at,
    archivedAt: row.archived_at,
    completedAt: row.completed_at,
    dueAt: row.due_at,
    saveState: row.save_state,
    saveStateDetail,
    localOnly: false,
    note:
      type === "note"
        ? {
            title: row.note_title?.trim() ?? "",
            body: row.note_body?.trim() ?? row.summary,
            linkedInitiativeId: row.linked_initiative_id,
            linkedInitiativeTitle: row.linked_initiative?.title ?? null
          }
        : null,
    sourceLinkage: mapPriorityInboxSourceLinkage(row),
    originCapture,
    task:
      type === "task"
        ? {
            title: taskTitle,
            description: taskDescription,
            nextStep: row.task_next_step?.trim() ?? "",
            desiredOutcome: row.task_desired_outcome?.trim() ?? "",
            status: getTaskStatus(row.completed_at),
            dueAt: row.due_at,
            priority,
            categoryId: row.task_category_id,
            categoryName,
            categoryIsFallback,
            linkedInitiativeId: row.linked_initiative_id,
            linkedInitiativeTitle: row.linked_initiative?.title ?? null
          }
        : null
  };
}

function mapLibraryDetail(row: CaptureRow): LibraryItemDetail {
  const summary = mapLibrarySummary(row);

  return {
    ...summary,
    originalContent: row.original_content,
    workingContent: row.working_content,
    updates: [...(row.capture_updates ?? [])]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .map(mapUpdateEntry)
  };
}

function mapLocalLibrarySummary(record: LocalPriorityInboxLibraryRecord): LibraryItemSummary {
  return {
    ...mapLibrarySummary(localLibraryRecordToCaptureRow(record)),
    localOnly: true
  };
}

function mapLocalLibraryDetail(record: LocalPriorityInboxLibraryRecord): LibraryItemDetail {
  return {
    ...mapLibraryDetail(localLibraryRecordToCaptureRow(record)),
    localOnly: true
  };
}

function mapPriorityInboxSourceLinkage(row: CaptureRow): PriorityInboxSourceLinkage | null {
  const rawMetadata = mapJsonRecord(row.priority_inbox_source_metadata);
  const priorityInboxItemId =
    (typeof rawMetadata?.priorityInboxItemId === "string" && rawMetadata.priorityInboxItemId) ||
    row.priority_inbox_item_id;
  const source = typeof rawMetadata?.source === "string" ? rawMetadata.source : null;

  if (!priorityInboxItemId || !source) {
    return null;
  }

  const forwardedRaw = mapJsonRecord(rawMetadata?.forwardedEmailSource);

  return {
    priorityInboxItemId,
    source,
    sourceLabel: typeof rawMetadata?.sourceLabel === "string" ? rawMetadata.sourceLabel : null,
    sourceFamily: typeof rawMetadata?.sourceFamily === "string" ? rawMetadata.sourceFamily : null,
    ingestionMode: typeof rawMetadata?.ingestionMode === "string" ? rawMetadata.ingestionMode : null,
    nativeSourceLink:
      (typeof rawMetadata?.nativeSourceLink === "string" && rawMetadata.nativeSourceLink) || row.native_source_link || null,
    fallbackDetailHref: typeof rawMetadata?.fallbackDetailHref === "string" ? rawMetadata.fallbackDetailHref : null,
    externalMessageId: typeof rawMetadata?.externalMessageId === "string" ? rawMetadata.externalMessageId : null,
    conversationId: typeof rawMetadata?.conversationId === "string" ? rawMetadata.conversationId : null,
    receivedAt: typeof rawMetadata?.receivedAt === "string" ? rawMetadata.receivedAt : null,
    sender: typeof rawMetadata?.sender === "string" ? rawMetadata.sender : null,
    senderRole: typeof rawMetadata?.senderRole === "string" ? rawMetadata.senderRole : null,
    threadTitle: typeof rawMetadata?.threadTitle === "string" ? rawMetadata.threadTitle : null,
    primaryLine: typeof rawMetadata?.primaryLine === "string" ? rawMetadata.primaryLine : null,
    summary: typeof rawMetadata?.summary === "string" ? rawMetadata.summary : null,
    metadata: mapJsonRecord(rawMetadata?.metadata),
    forwardedEmailSource:
      forwardedRaw && typeof forwardedRaw.id === "string" && typeof forwardedRaw.destinationAddress === "string"
        ? {
            id: forwardedRaw.id,
            destinationAddress: forwardedRaw.destinationAddress,
            forwardedByName: typeof forwardedRaw.forwardedByName === "string" ? forwardedRaw.forwardedByName : null,
            forwardedByEmail: typeof forwardedRaw.forwardedByEmail === "string" ? forwardedRaw.forwardedByEmail : null,
            originalSenderName: typeof forwardedRaw.originalSenderName === "string" ? forwardedRaw.originalSenderName : null,
            originalSenderEmail: typeof forwardedRaw.originalSenderEmail === "string" ? forwardedRaw.originalSenderEmail : null,
            originalSubject: typeof forwardedRaw.originalSubject === "string" ? forwardedRaw.originalSubject : null,
            originalReceivedAt:
              typeof forwardedRaw.originalReceivedAt === "string" ? forwardedRaw.originalReceivedAt : null,
            forwardedAt: typeof forwardedRaw.forwardedAt === "string" ? forwardedRaw.forwardedAt : null,
            providerHint:
              forwardedRaw.providerHint === "outlook" || forwardedRaw.providerHint === "gmail"
                ? forwardedRaw.providerHint
                : null,
            nativeSourceLink: typeof forwardedRaw.nativeSourceLink === "string" ? forwardedRaw.nativeSourceLink : null,
            detailBodyExcerpt: typeof forwardedRaw.detailBodyExcerpt === "string" ? forwardedRaw.detailBodyExcerpt : null,
            attachmentNames: Array.isArray(forwardedRaw.attachmentNames)
              ? forwardedRaw.attachmentNames.filter((entry): entry is string => typeof entry === "string")
              : [],
            metadata: mapJsonRecord(forwardedRaw.metadata)
          }
        : null
  };
}

function captureMetadataSearchValues(metadata: ExecutiveCaptureMetadata | null | undefined) {
  if (!metadata) {
    return [];
  }

  return Object.values(metadata).filter((value): value is string => typeof value === "string");
}

function matchesSearch(row: CaptureRow, search: string) {
  if (!search) {
    return true;
  }

  const captureMetadata = mapExecutiveCaptureMetadata(row.capture_metadata);
  const sourceMetadata = mapJsonRecord(row.priority_inbox_source_metadata);

  const haystack = [
    row.title,
    row.note_title,
    row.note_body,
    row.task_description,
    row.task_next_step,
    row.task_desired_outcome,
    row.task_category?.name,
    row.linked_initiative?.title,
    row.priority ?? null,
    row.executive_work_type ?? null,
    row.source_path,
    typeof sourceMetadata?.source === "string" ? sourceMetadata.source : null,
    typeof sourceMetadata?.sourceLabel === "string" ? sourceMetadata.sourceLabel : null,
    typeof sourceMetadata?.sender === "string" ? sourceMetadata.sender : null,
    typeof sourceMetadata?.threadTitle === "string" ? sourceMetadata.threadTitle : null,
    row.original_content,
    row.working_content,
    ...captureMetadataSearchValues(captureMetadata),
    ...(row.capture_updates ?? []).map((entry) => entry.body)
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(search);
}

function compareByLastActive(left: LibraryItemSummary, right: LibraryItemSummary) {
  return Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt);
}

function prioritySortRank(priority: TaskPriority | null) {
  if (priority === "high") {
    return 0;
  }

  if (priority === "medium") {
    return 1;
  }

  return 2;
}

function inlineDueCueRank(item: LibraryItemSummary) {
  if (item.type !== "task" || !item.dueAt || item.status === "completed") {
    return 2;
  }

  const dueAt = Date.parse(item.dueAt);
  if (Number.isNaN(dueAt)) {
    return 2;
  }

  const dueSoonWindow = Date.now() + 1000 * 60 * 60 * 24 * 3;
  if (dueAt < Date.now()) {
    return 0;
  }

  if (dueAt <= dueSoonWindow) {
    return 1;
  }

  return 2;
}

function sortLibraryItems(items: LibraryItemSummary[], query: LibraryQuery) {
  if (query.view === "recently-archived") {
    return [...items].sort((left, right) => {
      const leftArchived = left.archivedAt ? Date.parse(left.archivedAt) : Number.NEGATIVE_INFINITY;
      const rightArchived = right.archivedAt ? Date.parse(right.archivedAt) : Number.NEGATIVE_INFINITY;

      if (leftArchived !== rightArchived) {
        return rightArchived - leftArchived;
      }

      return compareLibraryItemsForExecutiveView(left, right);
    });
  }

  const scope = query.scope;
  if (scope === "library") {
    return [...items].sort(compareLibraryItemsForExecutiveView);
  }

  if (scope === "archived") {
    return [...items].sort(compareLibraryItemsForExecutiveView);
  }

  return [...items].sort((left, right) => {
    if (left.type !== "task" || right.type !== "task") {
      return compareByLastActive(left, right);
    }

    const leftPriority = prioritySortRank(left.task?.priority ?? null);
    const rightPriority = prioritySortRank(right.task?.priority ?? null);

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftFallback = left.task?.categoryIsFallback ? 0 : 1;
    const rightFallback = right.task?.categoryIsFallback ? 0 : 1;

    if (leftFallback !== rightFallback) {
      return leftFallback - rightFallback;
    }

    const categoryComparison = (left.task?.categoryName ?? "").localeCompare(right.task?.categoryName ?? "");
    if (categoryComparison !== 0) {
      return categoryComparison;
    }

    const leftRank = inlineDueCueRank(left);
    const rightRank = inlineDueCueRank(right);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (leftRank === 0 || leftRank === 1) {
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;

      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }
    }

    return compareByLastActive(left, right);
  });
}

function parseDueAt(value: string | null | undefined) {
  if (!value) {
    return { ok: true as const, value: null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      ok: false as const,
      error: "Due date could not be parsed."
    };
  }

  return {
    ok: true as const,
    value: parsed.toISOString()
  };
}

function parseTaskStatus(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (isLibraryTaskStatus(normalized)) {
    return {
      ok: true as const,
      value: normalized
    };
  }

  return {
    ok: false as const,
    error: "Task status must be active or completed."
  };
}

function parseTaskPriority(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (isTaskPriority(normalized)) {
    return {
      ok: true as const,
      value: normalized
    };
  }

  return {
    ok: false as const,
    error: "Task priority must be High, Medium, or Low."
  };
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

function createLibraryHref(captureId: string, type: "task" | "reference") {
  const base = type === "task" ? `/library/${captureId}?from=%2Flibrary%2Ftasks` : `/library/${captureId}?from=%2Flibrary`;
  return base;
}

function createCommitmentHref(captureId: string) {
  return `/library/${captureId}?from=%2Fcommitments`;
}

function getPriorityInboxDetailFallbackHref(item: PriorityInboxItem) {
  return item.source === "forwarded_email" && !item.sourceLink ? `/inbox/${item.id}` : null;
}

async function getForwardedEmailSourceCaptureRow(params: {
  client: CaptureLibraryDbClient;
  userId: string;
  itemId: string;
}) {
  const response = await withSupabaseTimeout(
    params.client
      .from("priority_inbox_forwarded_email_sources")
      .select(
        "id, destination_address, forwarded_by_name, forwarded_by_email, original_sender_name, original_sender_email, original_subject, original_received_at, forwarded_at, provider_hint, native_source_link, detail_body, raw_content, attachment_names, source_metadata"
      )
      .eq("user_id", params.userId)
      .eq("item_id", params.itemId)
      .maybeSingle<ForwardedEmailSourceCaptureRow>()
  );

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data ?? null;
}

function buildPriorityInboxLibraryContent(
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

function buildPriorityInboxSourceMetadata(
  item: PriorityInboxItem,
  forwardedSource?: ForwardedEmailSourceCaptureRow | null
) {
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
    forwardedEmailSource: forwardedSource
      ? {
          id: forwardedSource.id,
          destinationAddress: forwardedSource.destination_address,
          forwardedByName: forwardedSource.forwarded_by_name,
          forwardedByEmail: forwardedSource.forwarded_by_email,
          originalSenderName: forwardedSource.original_sender_name,
          originalSenderEmail: forwardedSource.original_sender_email,
          originalSubject: forwardedSource.original_subject,
          originalReceivedAt: forwardedSource.original_received_at,
          forwardedAt: forwardedSource.forwarded_at,
          providerHint: forwardedSource.provider_hint,
          nativeSourceLink: forwardedSource.native_source_link,
          detailBodyExcerpt: takeExcerpt(
            forwardedSource.detail_body ?? forwardedSource.raw_content,
            PRIORITY_INBOX_BODY_EXCERPT_LIMIT
          ),
          attachmentNames: forwardedSource.attachment_names ?? [],
          metadata: mapJsonRecord(forwardedSource.source_metadata)
        }
      : null,
    metadata: item.sourceMetadata ?? null
  };
}

export async function createCanonicalTaskFromPriorityInbox(params: {
  item: PriorityInboxItem;
  task: PriorityInboxCanonicalTaskInput;
}): Promise<PriorityInboxLibraryLinkResult> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false,
      error: "No active app user could be resolved."
    };
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const forwardedSource =
    params.item.source === "forwarded_email"
      ? await getForwardedEmailSourceCaptureRow({
          client,
          userId: resolved.user.id,
          itemId: params.item.id
        })
      : null;
  const description = params.task.description.trim();
  if (!description) {
    return {
      ok: false,
      error: "Task description is required."
    };
  }

  const priority = parseTaskPriority(params.task.priority);
  if (!priority.ok) {
    return {
      ok: false,
      error: priority.error
    };
  }

  const { data: categories } = await client
    .from("task_categories")
    .select("id, name, status, is_fallback")
    .eq("user_id", resolved.user.id)
    .order("sort_order", { ascending: true })
    .returns<CaptureTaskCategoryRow[]>();

  const activeCategories = (categories ?? []).filter((category) => category.status === "active");
  const selectedCategory =
    activeCategories.find((category) => category.id === params.task.categoryId) ??
    activeCategories.find((category) => category.is_fallback) ??
    null;

  if (!selectedCategory) {
    return {
      ok: false,
      error: "Task categories are not configured correctly."
    };
  }

  let linkedInitiativeId: string | null = null;
  let linkedInitiativeTitle: string | null = null;
  if (params.task.linkedInitiativeId) {
    const { data } = await client
      .from("initiatives")
      .select("id, title")
      .eq("user_id", resolved.user.id)
      .eq("id", params.task.linkedInitiativeId)
      .maybeSingle<{ id: string; title: string }>();

    linkedInitiativeId = data?.id ?? null;
    linkedInitiativeTitle = data?.title ?? null;
  }

  const content = [
    buildTaskWorkingContent(
      {
        description,
        nextStep: params.task.nextStep?.trim() ?? "",
        desiredOutcome: params.task.desiredOutcome?.trim() ?? "",
        priority: priority.value,
        categoryId: selectedCategory.id,
        linkedInitiativeId,
        dueAt: null
      },
      {
        categoryName: selectedCategory.name,
        initiativeTitle: linkedInitiativeTitle
      }
    ),
    takeExcerpt(forwardedSource?.detail_body ?? forwardedSource?.raw_content, PRIORITY_INBOX_BODY_EXCERPT_LIMIT)
      ? `Forwarded detail:\n${takeExcerpt(forwardedSource?.detail_body ?? forwardedSource?.raw_content, PRIORITY_INBOX_BODY_EXCERPT_LIMIT)}`
      : null,
    `Source linkage:\n${formatPriorityInboxSourceBlock(params.item)}`,
    params.item.sensitiveContext?.trim() ? `Sensitive context:\n${params.item.sensitiveContext.trim()}` : null
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
  const now = new Date().toISOString();
  const title = computeTaskDisplayTitle(description);
  const insert = await withSupabaseTimeout(
    client
      .from("captures")
      .insert({
        user_id: resolved.user.id,
        source_path: "/inbox",
        native_source_link: params.item.sourceLink ?? null,
        priority_inbox_item_id: params.item.id,
        priority_inbox_source_metadata: buildPriorityInboxSourceMetadata(params.item, forwardedSource),
        pattern: "task",
        privacy: params.item.sensitiveContext ? "hybrid" : "open",
        summary: description,
        follow_up: [params.task.nextStep?.trim() ?? "", params.task.desiredOutcome?.trim() ?? ""]
          .filter(Boolean)
          .join("\n\n") || params.item.summary,
        private_context: params.item.sensitiveContext ?? null,
        type: "task",
        title,
        task_description: description,
        task_next_step: params.task.nextStep?.trim() || null,
        task_desired_outcome: params.task.desiredOutcome?.trim() || null,
        task_category_id: selectedCategory.id,
        linked_initiative_id: linkedInitiativeId,
        origin_type: "email",
        original_content: content,
        working_content: content,
        last_active_at: now,
        priority: priority.value,
        save_state: "saved",
        save_state_detail: null
      })
      .select("id, title")
      .single<{ id: string; title: string }>()
  );

  if (insert.error || !insert.data) {
    return {
      ok: false,
      error: insert.error?.message ?? "Task could not be created from Priority Inbox."
    };
  }

  return {
    ok: true,
    object: {
      type: "task",
      title: insert.data.title,
      href: createLibraryHref(insert.data.id, "task"),
      captureId: insert.data.id
    }
  };
}

export async function createCanonicalReferenceFromPriorityInbox(params: {
  item: PriorityInboxItem;
  reference: PriorityInboxCanonicalReferenceInput;
}): Promise<PriorityInboxLibraryLinkResult> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false,
      error: "No active app user could be resolved."
    };
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const forwardedSource =
    params.item.source === "forwarded_email"
      ? await getForwardedEmailSourceCaptureRow({
          client,
          userId: resolved.user.id,
          itemId: params.item.id
        })
      : null;
  const title = params.reference.title.trim();
  if (!title) {
    return {
      ok: false,
      error: "Reference title is required."
    };
  }

  const content = buildPriorityInboxLibraryContent(
    params.item,
    params.reference.summary,
    takeExcerpt(forwardedSource?.detail_body ?? forwardedSource?.raw_content, PRIORITY_INBOX_BODY_EXCERPT_LIMIT)
  );
  const noteBody = params.reference.summary.trim() || params.item.summary;
  const workingContent = buildNoteWorkingContent({
    title,
    body: noteBody,
    linkedInitiativeId: null
  });
  const now = new Date().toISOString();
  const insert = await withSupabaseTimeout(
    client
      .from("captures")
      .insert({
        user_id: resolved.user.id,
        source_path: "/inbox",
        native_source_link: params.item.sourceLink ?? null,
        priority_inbox_item_id: params.item.id,
        priority_inbox_source_metadata: buildPriorityInboxSourceMetadata(params.item, forwardedSource),
        pattern: "note",
        privacy: params.item.sensitiveContext ? "hybrid" : "open",
        summary: noteBody,
        follow_up: title,
        private_context: params.item.sensitiveContext ?? null,
        type: "note",
        title,
        note_title: title,
        note_body: noteBody,
        original_content: content,
        working_content: workingContent,
        origin_type: "email",
        last_active_at: now,
        save_state: "saved",
        save_state_detail: null
      })
      .select("id, title")
      .single<{ id: string; title: string }>()
  );

  if (insert.error || !insert.data) {
    return {
      ok: false,
      error: insert.error?.message ?? "Reference could not be saved from Priority Inbox."
    };
  }

  return {
    ok: true,
    object: {
      type: "reference",
      title: insert.data.title,
      href: createLibraryHref(insert.data.id, "reference"),
      captureId: insert.data.id
    }
  };
}

export async function createCanonicalCommitmentFromPriorityInbox(params: {
  item: PriorityInboxItem;
  commitment: PriorityInboxCanonicalCommitmentInput;
}): Promise<PriorityInboxLibraryLinkResult> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false,
      error: "No active app user could be resolved."
    };
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const title = params.commitment.statement.trim();
  if (!title) {
    return {
      ok: false,
      error: "Commitment statement is required."
    };
  }

  const dueAt = parseDueAt(params.commitment.dueAt);
  if (!dueAt.ok) {
    return {
      ok: false,
      error: dueAt.error
    };
  }

  const contextLines = [
    params.commitment.contextNote?.trim() || null,
    params.commitment.owedTo.trim() ? `Owed to: ${params.commitment.owedTo.trim()}` : null,
    params.commitment.dueLabel?.trim() ? `Timing note: ${params.commitment.dueLabel.trim()}` : null
  ].filter((line): line is string => Boolean(line));

  const { data: categories } = await client
    .from("task_categories")
    .select("id, name, status, is_fallback")
    .eq("user_id", resolved.user.id)
    .order("sort_order", { ascending: true })
    .returns<CaptureTaskCategoryRow[]>();
  const fallbackCategory =
    (categories ?? []).find((category) => category.status === "active" && category.is_fallback) ?? null;
  if (!fallbackCategory) {
    return {
      ok: false,
      error: "Task categories are not configured correctly."
    };
  }

  const content = buildPriorityInboxLibraryContent(params.item, contextLines.join("\n"));
  const workingContent = buildTaskWorkingContent(
    {
      description: title,
      nextStep: params.commitment.contextNote?.trim() ?? "",
      desiredOutcome: "",
      priority: "medium",
      categoryId: fallbackCategory.id,
      linkedInitiativeId: null,
      dueAt: dueAt.value
    },
    {
      categoryName: fallbackCategory.name
    }
  );
  const now = new Date().toISOString();
  const insert = await withSupabaseTimeout(
    client
      .from("captures")
      .insert({
        user_id: resolved.user.id,
        source_path: "/commitments",
        native_source_link: params.item.sourceLink ?? null,
        priority_inbox_item_id: params.item.id,
        priority_inbox_source_metadata: buildPriorityInboxSourceMetadata(params.item),
        pattern: "task",
        privacy: params.item.sensitiveContext ? "hybrid" : "open",
        summary: title,
        follow_up: contextLines.join("\n") || params.item.summary,
        private_context: params.item.sensitiveContext ?? null,
        type: "task",
        title,
        task_description: title,
        task_next_step: params.commitment.contextNote?.trim() || null,
        task_desired_outcome: null,
        task_category_id: fallbackCategory.id,
        linked_initiative_id: null,
        origin_type: "email",
        original_content: content,
        working_content: workingContent,
        last_active_at: now,
        due_at: dueAt.value,
        priority: "medium",
        save_state: "saved",
        save_state_detail: null
      })
      .select("id, title")
      .single<{ id: string; title: string }>()
  );

  if (insert.error || !insert.data) {
    return {
      ok: false,
      error: insert.error?.message ?? "Commitment could not be created from Priority Inbox."
    };
  }

  return {
    ok: true,
    object: {
      type: "commitment",
      title: insert.data.title,
      href: createCommitmentHref(insert.data.id),
      captureId: insert.data.id
    }
  };
}

async function setCaptureSaveState(
  userId: string,
  captureId: string,
  state: CaptureSaveState,
  detail: string | null
) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return;
  }

  await resolved.client
    .from("captures")
    .update({
      save_state: state,
      save_state_detail: detail
    })
    .eq("user_id", userId)
    .eq("id", captureId);
}

async function getOwnedCapture(captureId: string) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false as const,
      error: "No active app user could be resolved."
    };
  }

  const { client, user } = resolved;
  const { data, error } = await client
    .from("captures")
    .select(
      "id, user_id, source_path, privacy, private_context, type, title, note_title, note_body, task_description, task_next_step, task_desired_outcome, task_category_id, linked_initiative_id, due_at, priority, executive_work_type, capture_metadata, archived_at, completed_at, deleted_at"
    )
    .eq("user_id", user.id)
    .eq("id", captureId)
    .maybeSingle<OwnedCaptureRow>();

  if (error || !data || data.deleted_at) {
    return {
      ok: false as const,
      error: "That library item could not be found."
    };
  }

  return {
    ok: true as const,
    client,
    user,
    capture: data
  };
}

export function parseLibraryQuery(
  raw: Record<string, string | string[] | undefined>,
  scope: LibraryScope
): LibraryQuery {
  return parseLibraryQueryParams(raw, scope);
}

export async function listLibraryItems(query: LibraryQuery): Promise<LibraryItemSummary[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return [];
  }

  const { client, user } = resolved;
  const localRecords = await listLocalPriorityInboxLibraryItems(user.id);
  function buildScopedCaptureListRequest(selectClause: string) {
    let request = client
      .from("captures")
      .select(selectClause)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (query.status === "archived") {
      request = request.not("archived_at", "is", null);
    } else if (query.status !== "all") {
      request = request.is("archived_at", null);
    }

    if (query.scope === "tasks") {
      request = request.eq("type", "task");
    }

    if (query.scope === "tasks" && query.category !== "all") {
      request = request.eq("task_category_id", query.category);
    }

    return request;
  }

  let data: CaptureRow[] | null = null;
  let error: CaptureLibraryQueryError | null = null;

  try {
    const response = await runCaptureQueryWithRetries(() =>
      withSupabaseTimeout(buildScopedCaptureListRequest(CAPTURE_LIBRARY_SELECT).returns<CaptureRow[]>())
    );
    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = {
      message: requestError instanceof Error ? requestError.message : "Unknown capture library list error."
    };
  }

  if (error && shouldUseCurlCaptureLibraryFallback(error)) {
    const fallbackData = await readCapturesViaCurlFallback({
      userId: user.id,
      archivedFilter: query.status === "archived" ? "only" : query.status === "all" ? "all" : "exclude",
      tasksOnly: query.scope === "tasks"
    });

    if (fallbackData) {
      data = fallbackData;
      error = null;
      logCaptureLibrary("Recovered library list via curl fallback.", {
        userId: user.id,
        scope: query.scope,
        count: fallbackData.length
      });
    }
  }

  if (error || !data) {
    logCaptureLibrary("Library list query returned no data.", {
      userId: user.id,
      scope: query.scope,
      errorMessage: error?.message ?? null,
      errorCode: error?.code ?? null,
      errorDetails: error?.details ?? null,
      errorHint: error?.hint ?? null
    });
  }

  const normalizedSearch = normalizeSearchText(query.search);
  const remoteItems = (data ?? []).filter((row) => matchesSearch(row, normalizedSearch)).map(mapLibrarySummary);
  const localItems = localRecords
    .filter((record) => matchesSearch(localLibraryRecordToCaptureRow(record), normalizedSearch))
    .map(mapLocalLibrarySummary);

  return sortLibraryItems(filterLibraryItems([...remoteItems, ...localItems], query), query);
}

export async function getLibraryItemDetail(captureId: string): Promise<LibraryItemDetail | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const { client, user } = resolved;
  const localRecord = await getLocalPriorityInboxLibraryItem(user.id, captureId);
  if (localRecord) {
    return mapLocalLibraryDetail(localRecord);
  }
  let data: CaptureRow | null = null;
  let error: CaptureLibraryQueryError | null = null;

  try {
    const response = await runCaptureQueryWithRetries(() =>
      withSupabaseTimeout(
        client
          .from("captures")
          .select(CAPTURE_LIBRARY_SELECT)
          .eq("user_id", user.id)
          .eq("id", captureId)
          .maybeSingle<CaptureRow>()
      )
    );

    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = {
      message: requestError instanceof Error ? requestError.message : "Unknown capture detail error."
    };
  }

  if (error && shouldUseCurlCaptureLibraryFallback(error)) {
    const fallbackData = await readCapturesViaCurlFallback({
      userId: user.id,
      captureId,
      archivedFilter: "all"
    });

    if (fallbackData?.[0]) {
      data = fallbackData[0];
      error = null;
      logCaptureLibrary("Recovered library detail via curl fallback.", {
        userId: user.id,
        captureId
      });
    }
  }

  if (error || !data || data.deleted_at) {
    if (error) {
      logCaptureLibrary("Library detail query failed.", {
        userId: user.id,
        captureId,
        errorMessage: error.message,
        errorCode: error.code ?? null,
        errorDetails: error.details ?? null,
        errorHint: error.hint ?? null
      });
    }
    return null;
  }

  return mapLibraryDetail(data);
}

export async function updateLibraryItemWorkingCopy(input: {
  captureId: string;
  title?: string | null;
  workingContent: string;
  linkedInitiativeId?: string | null;
}): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(input.captureId);
  if (!owned.ok) {
    return owned;
  }

  if ((owned.capture.type ?? "note") !== "note") {
    return {
      ok: false,
      error: "Only notes use this editor."
    };
  }

  const body = input.workingContent.trim();
  if (!body) {
    return {
      ok: false,
      error: "Note body is required."
    };
  }

  const noteTitle = (input.title ?? owned.capture.note_title ?? "").trim();
  const title = computeNoteDisplayTitle(noteTitle, body);
  let initiativeId: string | null = null;

  if (input.linkedInitiativeId) {
    const { data } = await owned.client
      .from("initiatives")
      .select("id")
      .eq("user_id", owned.user.id)
      .eq("id", input.linkedInitiativeId)
      .maybeSingle<{ id: string }>();

    initiativeId = data?.id ?? null;
  }

  const workingContent = buildNoteWorkingContent({
    title: noteTitle,
    body,
    linkedInitiativeId: initiativeId
  });

  const { error } = await owned.client
    .from("captures")
    .update({
      title,
      note_title: noteTitle || null,
      note_body: body,
      summary: body,
      follow_up: noteTitle || null,
      linked_initiative_id: initiativeId,
      working_content: workingContent,
      last_active_at: new Date().toISOString(),
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", input.captureId);

  if (error) {
    await setCaptureSaveState(owned.user.id, input.captureId, "error", "Working content could not be saved.");
    return {
      ok: false,
      error: "Working content could not be saved."
    };
  }

  return {
    ok: true
  };
}

export async function updateLibraryTaskDetails(input: {
  captureId: string;
  description: string;
  nextStep?: string | null;
  desiredOutcome?: string | null;
  status: string;
  dueAt?: string | null;
  priority?: string | null;
  categoryId?: string | null;
  linkedInitiativeId?: string | null;
}): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(input.captureId);
  if (!owned.ok) {
    return owned;
  }

  if ((owned.capture.type ?? "note") !== "task") {
    return {
      ok: false,
      error: "Only task captures can be edited as tasks."
    };
  }

  const description = input.description.trim();
  if (!description) {
    return {
      ok: false,
      error: "Task description is required."
    };
  }

  const status = parseTaskStatus(input.status);
  if (!status.ok) {
    return {
      ok: false,
      error: status.error
    };
  }

  const dueAt = parseDueAt(input.dueAt);
  if (!dueAt.ok) {
    return {
      ok: false,
      error: dueAt.error
    };
  }

  const priority = parseTaskPriority(input.priority);
  if (!priority.ok) {
    return {
      ok: false,
      error: priority.error
    };
  }

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (input.categoryId) {
    const { data } = await owned.client
      .from("task_categories")
      .select("id, name, status, is_fallback")
      .eq("user_id", owned.user.id)
      .eq("id", input.categoryId)
      .maybeSingle<CaptureTaskCategoryRow>();

    if (data && data.status === "active") {
      categoryId = data.id;
      categoryName = data.name;
    }
  }

  if (!categoryId) {
    const { data } = await owned.client
      .from("task_categories")
      .select("id, name, status, is_fallback")
      .eq("user_id", owned.user.id)
      .eq("is_fallback", true)
      .maybeSingle<CaptureTaskCategoryRow>();

    categoryId = data?.id ?? null;
    categoryName = data?.name ?? "TBD";
  }

  if (!categoryId) {
    return {
      ok: false,
      error: "Task categories are not configured correctly."
    };
  }

  let initiativeId: string | null = null;
  let initiativeTitle: string | null = null;
  if (input.linkedInitiativeId) {
    const { data } = await owned.client
      .from("initiatives")
      .select("id, title")
      .eq("user_id", owned.user.id)
      .eq("id", input.linkedInitiativeId)
      .maybeSingle<{ id: string; title: string }>();

    initiativeId = data?.id ?? null;
    initiativeTitle = data?.title ?? null;
  }

  const nextStep = input.nextStep?.trim() ?? "";
  const desiredOutcome = input.desiredOutcome?.trim() ?? "";
  const title = computeTaskDisplayTitle(description);
  const workingContent = buildTaskWorkingContent(
    {
      description,
      nextStep,
      desiredOutcome,
      priority: priority.value,
      categoryId,
      linkedInitiativeId: initiativeId,
      dueAt: dueAt.value
    } satisfies TaskFields,
    {
      categoryName,
      initiativeTitle
    }
  );

  const now = new Date().toISOString();
  const { error } = await owned.client
    .from("captures")
    .update({
      title,
      summary: description,
      follow_up: [nextStep, desiredOutcome].filter(Boolean).join("\n\n") || null,
      task_description: description,
      task_next_step: nextStep || null,
      task_desired_outcome: desiredOutcome || null,
      task_category_id: categoryId,
      linked_initiative_id: initiativeId,
      working_content: workingContent,
      completed_at: status.value === "completed" ? owned.capture.completed_at ?? now : null,
      due_at: dueAt.value,
      priority: priority.value,
      last_active_at: now,
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", input.captureId);

  if (error) {
    await setCaptureSaveState(owned.user.id, input.captureId, "error", "Task details could not be saved.");
    return {
      ok: false,
      error: "Task details could not be saved."
    };
  }

  return {
    ok: true
  };
}

export async function updateExecutiveLibraryItemDetails(input: {
  captureId: string;
  mode: "decision" | "opportunity" | "waiting_on" | "meeting_note";
  title?: string | null;
  body?: string | null;
  description?: string | null;
  nextStep?: string | null;
  desiredOutcome?: string | null;
  taskStatus?: string | null;
  dueAt?: string | null;
  priority?: string | null;
  categoryId?: string | null;
  linkedInitiativeId?: string | null;
  metadataStatus?: string | null;
  companyOrCounterparty?: string | null;
  strategicRelevance?: string | null;
  owner?: string | null;
  nextAction?: string | null;
  relatedCompany?: string | null;
  relatedOpportunity?: string | null;
  relatedPerson?: string | null;
  decisionQuestion?: string | null;
  recommendation?: string | null;
  optionsTradeoffs?: string | null;
  risks?: string | null;
  peopleInvolved?: string | null;
  waitingOn?: string | null;
  expectedOutcome?: string | null;
  delegatedTo?: string | null;
  lastTouch?: string | null;
  meetingTitle?: string | null;
  meetingAt?: string | null;
  attendees?: string | null;
  decisions?: string | null;
  followUps?: string | null;
  waitingOnItems?: string | null;
}): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(input.captureId);
  if (!owned.ok) {
    return owned;
  }

  const currentMode = resolveOwnedCaptureEditorMode(owned.capture);
  if (currentMode !== input.mode) {
    return {
      ok: false,
      error: "This item no longer matches the requested executive editor."
    };
  }

  let initiativeId: string | null = null;
  let initiativeTitle: string | null = null;
  if (input.linkedInitiativeId) {
    const { data } = await owned.client
      .from("initiatives")
      .select("id, title")
      .eq("user_id", owned.user.id)
      .eq("id", input.linkedInitiativeId)
      .maybeSingle<{ id: string; title: string }>();

    initiativeId = data?.id ?? null;
    initiativeTitle = data?.title ?? null;
  }

  const now = new Date().toISOString();

  if (input.mode === "decision") {
    if ((owned.capture.type ?? "note") !== "note") {
      return {
        ok: false,
        error: "Decision captures should remain note-compatible."
      };
    }

    const decisionQuestion = normalizeOptionalText(input.decisionQuestion);
    if (!decisionQuestion) {
      return {
        ok: false,
        error: "Decision question is required."
      };
    }

    const dueAt = parseDueAt(input.dueAt);
    if (!dueAt.ok) {
      return dueAt;
    }

    const priority = parseOptionalTaskPriority(input.priority);
    if (!priority.ok) {
      return priority;
    }

    const body = normalizeOptionalText(input.body);
    const metadata = mergeExecutiveCaptureMetadata(owned.capture.capture_metadata, {
      captureType: "decision",
      decisionQuestion,
      recommendation: normalizeOptionalText(input.recommendation),
      optionsTradeoffs: normalizeOptionalText(input.optionsTradeoffs),
      risks: normalizeOptionalText(input.risks),
      deadline: dueAt.value,
      peopleInvolved: normalizeOptionalText(input.peopleInvolved),
      status: normalizeOptionalText(input.metadataStatus)
    });
    const title = computeNoteDisplayTitle(
      decisionQuestion,
      firstNonEmptyText(body, metadata.recommendation, metadata.optionsTradeoffs, metadata.risks, decisionQuestion) ?? ""
    );
    const summary = firstNonEmptyText(
      metadata.recommendation,
      body,
      metadata.optionsTradeoffs,
      metadata.risks,
      decisionQuestion
    );
    const workingContent = buildExecutiveNoteWorkingContent({
      captureType: "decision",
      title: decisionQuestion,
      body,
      metadata,
      linkedInitiativeTitle: initiativeTitle,
      dueAt: dueAt.value,
      priority: priority.value
    });

    const { error } = await owned.client
      .from("captures")
      .update({
        title,
        note_title: decisionQuestion,
        note_body: body,
        summary: summary ?? decisionQuestion,
        follow_up: metadata.recommendation ?? null,
        linked_initiative_id: initiativeId,
        working_content: workingContent,
        due_at: dueAt.value,
        priority: priority.value,
        capture_metadata: metadata,
        last_active_at: now,
        save_state: "saved",
        save_state_detail: null
      })
      .eq("user_id", owned.user.id)
      .eq("id", input.captureId);

    if (error) {
      await setCaptureSaveState(owned.user.id, input.captureId, "error", "Decision details could not be saved.");
      return {
        ok: false,
        error: "Decision details could not be saved."
      };
    }

    return { ok: true };
  }

  if (input.mode === "opportunity") {
    if ((owned.capture.type ?? "note") !== "note") {
      return {
        ok: false,
        error: "Opportunity captures should remain note-compatible."
      };
    }

    const titleValue = normalizeOptionalText(input.title);
    if (!titleValue) {
      return {
        ok: false,
        error: "Opportunity title is required."
      };
    }

    const priority = parseOptionalTaskPriority(input.priority);
    if (!priority.ok) {
      return priority;
    }

    const body = normalizeOptionalText(input.body);
    const metadata = mergeExecutiveCaptureMetadata(owned.capture.capture_metadata, {
      captureType: "opportunity",
      companyOrCounterparty: normalizeOptionalText(input.companyOrCounterparty),
      strategicRelevance: normalizeOptionalText(input.strategicRelevance),
      owner: normalizeOptionalText(input.owner),
      status: normalizeOptionalText(input.metadataStatus),
      nextAction: normalizeOptionalText(input.nextAction),
      relatedCompany: normalizeOptionalText(input.relatedCompany),
      relatedPerson: normalizeOptionalText(input.relatedPerson)
    });
    const title = computeNoteDisplayTitle(
      titleValue,
      firstNonEmptyText(body, metadata.strategicRelevance, metadata.nextAction, titleValue) ?? ""
    );
    const summary = firstNonEmptyText(
      metadata.strategicRelevance,
      metadata.nextAction,
      body,
      titleValue
    );
    const workingContent = buildExecutiveNoteWorkingContent({
      captureType: "opportunity",
      title: titleValue,
      body,
      metadata,
      linkedInitiativeTitle: initiativeTitle,
      priority: priority.value
    });

    const { error } = await owned.client
      .from("captures")
      .update({
        title,
        note_title: titleValue,
        note_body: body,
        summary: summary ?? titleValue,
        follow_up: metadata.nextAction ?? null,
        linked_initiative_id: initiativeId,
        working_content: workingContent,
        priority: priority.value,
        capture_metadata: metadata,
        last_active_at: now,
        save_state: "saved",
        save_state_detail: null
      })
      .eq("user_id", owned.user.id)
      .eq("id", input.captureId);

    if (error) {
      await setCaptureSaveState(owned.user.id, input.captureId, "error", "Opportunity details could not be saved.");
      return {
        ok: false,
        error: "Opportunity details could not be saved."
      };
    }

    return { ok: true };
  }

  if (input.mode === "meeting_note") {
    if ((owned.capture.type ?? "note") !== "note") {
      return {
        ok: false,
        error: "Meeting-note captures should remain note-compatible."
      };
    }

    const meetingTitle = normalizeOptionalText(input.meetingTitle);
    if (!meetingTitle) {
      return {
        ok: false,
        error: "Meeting title is required."
      };
    }

    const meetingAt = parseDueAt(input.meetingAt);
    if (!meetingAt.ok) {
      return {
        ok: false,
        error: "Meeting date could not be parsed."
      };
    }

    const body = normalizeOptionalText(input.body);
    const metadata = mergeExecutiveCaptureMetadata(owned.capture.capture_metadata, {
      captureType: "meeting_note",
      meetingTitle,
      meetingAt: meetingAt.value,
      attendees: normalizeOptionalText(input.attendees),
      decisions: normalizeOptionalText(input.decisions),
      followUps: normalizeOptionalText(input.followUps),
      waitingOnItems: normalizeOptionalText(input.waitingOnItems),
      relatedCompany: normalizeOptionalText(input.relatedCompany),
      relatedPerson: normalizeOptionalText(input.relatedPerson)
    });
    const title = computeNoteDisplayTitle(
      meetingTitle,
      firstNonEmptyText(body, metadata.decisions, metadata.followUps, meetingTitle) ?? ""
    );
    const summary = firstNonEmptyText(body, metadata.decisions, metadata.followUps, meetingTitle);
    const workingContent = buildExecutiveNoteWorkingContent({
      captureType: "meeting_note",
      title: meetingTitle,
      body,
      metadata,
      linkedInitiativeTitle: initiativeTitle
    });

    const { error } = await owned.client
      .from("captures")
      .update({
        title,
        note_title: meetingTitle,
        note_body: body,
        summary: summary ?? meetingTitle,
        follow_up: metadata.followUps ?? null,
        linked_initiative_id: initiativeId,
        working_content: workingContent,
        capture_metadata: metadata,
        last_active_at: now,
        save_state: "saved",
        save_state_detail: null
      })
      .eq("user_id", owned.user.id)
      .eq("id", input.captureId);

    if (error) {
      await setCaptureSaveState(owned.user.id, input.captureId, "error", "Meeting note details could not be saved.");
      return {
        ok: false,
        error: "Meeting note details could not be saved."
      };
    }

    return { ok: true };
  }

  if ((owned.capture.type ?? "note") !== "task") {
    return {
      ok: false,
      error: "Waiting-on captures should remain task-compatible."
    };
  }

  const description = normalizeOptionalText(input.description);
  if (!description) {
    return {
      ok: false,
      error: "Waiting-on summary is required."
    };
  }

  const taskStatus = parseTaskStatus(input.taskStatus);
  if (!taskStatus.ok) {
    return {
      ok: false,
      error: taskStatus.error
    };
  }

  const dueAt = parseDueAt(input.dueAt);
  if (!dueAt.ok) {
    return dueAt;
  }

  const priority = parseTaskPriority(input.priority);
  if (!priority.ok) {
    return priority;
  }

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  if (input.categoryId) {
    const { data } = await owned.client
      .from("task_categories")
      .select("id, name, status, is_fallback")
      .eq("user_id", owned.user.id)
      .eq("id", input.categoryId)
      .maybeSingle<CaptureTaskCategoryRow>();

    if (data && data.status === "active") {
      categoryId = data.id;
      categoryName = data.name;
    }
  }

  if (!categoryId) {
    const { data } = await owned.client
      .from("task_categories")
      .select("id, name, status, is_fallback")
      .eq("user_id", owned.user.id)
      .eq("is_fallback", true)
      .maybeSingle<CaptureTaskCategoryRow>();

    categoryId = data?.id ?? null;
    categoryName = data?.name ?? "TBD";
  }

  if (!categoryId) {
    return {
      ok: false,
      error: "Task categories are not configured correctly."
    };
  }

  const nextStep = normalizeOptionalText(input.nextStep) ?? "";
  const desiredOutcome = normalizeOptionalText(input.expectedOutcome) ?? normalizeOptionalText(input.desiredOutcome) ?? "";
  const lastTouch = parseDueAt(input.lastTouch);
  if (!lastTouch.ok) {
    return {
      ok: false,
      error: "Last touch date could not be parsed."
    };
  }

  const metadata = mergeExecutiveCaptureMetadata(owned.capture.capture_metadata, {
    captureType: "waiting_on",
    waitingOn: normalizeOptionalText(input.waitingOn),
    expectedOutcome: desiredOutcome || null,
    delegatedTo: normalizeOptionalText(input.delegatedTo),
    lastTouch: lastTouch.value,
    followUpAt: dueAt.value,
    relatedOpportunity: normalizeOptionalText(input.relatedOpportunity)
  });
  const title = computeTaskDisplayTitle(description);
  const workingContent = buildExecutiveTaskWorkingContent({
    description,
    nextStep,
    desiredOutcome,
    priority: priority.value,
    categoryName,
    linkedInitiativeTitle: initiativeTitle,
    dueAt: dueAt.value,
    metadata
  });

  const { error } = await owned.client
    .from("captures")
    .update({
      title,
      summary: description,
      follow_up: [nextStep, desiredOutcome].filter(Boolean).join("\n\n") || null,
      task_description: description,
      task_next_step: nextStep || null,
      task_desired_outcome: desiredOutcome || null,
      task_category_id: categoryId,
      linked_initiative_id: initiativeId,
      working_content: workingContent,
      completed_at: taskStatus.value === "completed" ? owned.capture.completed_at ?? now : null,
      due_at: dueAt.value,
      priority: priority.value,
      capture_metadata: metadata,
      last_active_at: now,
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", input.captureId);

  if (error) {
    await setCaptureSaveState(owned.user.id, input.captureId, "error", "Waiting-on details could not be saved.");
    return {
      ok: false,
      error: "Waiting-on details could not be saved."
    };
  }

  return { ok: true };
}

export async function createTaskFromNote(input: {
  captureId: string;
  description: string;
  nextStep?: string | null;
  desiredOutcome?: string | null;
  priority?: string | null;
  categoryId?: string | null;
  linkedInitiativeId?: string | null;
}): Promise<PriorityInboxLibraryLinkResult> {
  const owned = await getOwnedCapture(input.captureId);
  if (!owned.ok) {
    return {
      ok: false,
      error: owned.error
    };
  }

  if ((owned.capture.type ?? "note") !== "note") {
    return {
      ok: false,
      error: "Only notes can be converted into tasks."
    };
  }

  const description = input.description.trim();
  if (!description) {
    return {
      ok: false,
      error: "Task description is required."
    };
  }

  const priority = parseTaskPriority(input.priority);
  if (!priority.ok) {
    return {
      ok: false,
      error: priority.error
    };
  }

  const { data: categories } = await owned.client
    .from("task_categories")
    .select("id, name, status, is_fallback")
    .eq("user_id", owned.user.id)
    .order("sort_order", { ascending: true })
    .returns<CaptureTaskCategoryRow[]>();
  const activeCategories = (categories ?? []).filter((category) => category.status === "active");
  const selectedCategory =
    activeCategories.find((category) => category.id === input.categoryId) ??
    activeCategories.find((category) => category.is_fallback) ??
    null;

  if (!selectedCategory) {
    return {
      ok: false,
      error: "Task categories are not configured correctly."
    };
  }

  let initiativeId: string | null = null;
  let initiativeTitle: string | null = null;
  if (input.linkedInitiativeId) {
    const { data } = await owned.client
      .from("initiatives")
      .select("id, title")
      .eq("user_id", owned.user.id)
      .eq("id", input.linkedInitiativeId)
      .maybeSingle<{ id: string; title: string }>();

    initiativeId = data?.id ?? null;
    initiativeTitle = data?.title ?? null;
  }

  const noteTitle = owned.capture.note_title?.trim() ?? "";
  const noteBody = owned.capture.note_body?.trim() ?? "";
  const taskFields: TaskFields = {
    description,
    nextStep: input.nextStep?.trim() ?? "",
    desiredOutcome: input.desiredOutcome?.trim() ?? "",
    priority: priority.value,
    categoryId: selectedCategory.id,
    linkedInitiativeId: initiativeId,
    dueAt: null
  };
  const workingContent = buildTaskWorkingContent(taskFields, {
    categoryName: selectedCategory.name,
    initiativeTitle
  });
  const originalContent = [
    workingContent,
    noteTitle || noteBody ? `Source note:\n${buildNoteWorkingContent({ title: noteTitle, body: noteBody, linkedInitiativeId: null })}` : null
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
  const now = new Date().toISOString();
  const title = computeTaskDisplayTitle(description);
  const insert = await owned.client
    .from("captures")
    .insert({
      user_id: owned.user.id,
      source_path: owned.capture.source_path,
      pattern: "task",
      privacy: owned.capture.privacy,
      summary: description,
      follow_up: [taskFields.nextStep, taskFields.desiredOutcome].filter(Boolean).join("\n\n") || null,
      private_context: owned.capture.private_context,
      type: "task",
      title,
      task_description: description,
      task_next_step: taskFields.nextStep || null,
      task_desired_outcome: taskFields.desiredOutcome || null,
      task_category_id: selectedCategory.id,
      linked_initiative_id: initiativeId,
      origin_capture_id: owned.capture.id,
      origin_type: "note",
      original_content: originalContent,
      working_content: workingContent,
      last_active_at: now,
      due_at: null,
      priority: priority.value,
      save_state: "saved",
      save_state_detail: null
    })
    .select("id, title")
    .single<{ id: string; title: string }>();

  if (insert.error || !insert.data) {
    return {
      ok: false,
      error: insert.error?.message ?? "Task could not be created from the note."
    };
  }

  return {
    ok: true,
    object: {
      type: "task",
      title: insert.data.title,
      href: createLibraryHref(insert.data.id, "task"),
      captureId: insert.data.id
    }
  };
}

const TODAY_TASK_LIMIT = 3;
const TODAY_DUE_SOON_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;

function dueAtTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function listTodayTasks(now = Date.now()): Promise<{
  overdue: LibraryItemSummary[];
  dueSoon: LibraryItemSummary[];
}> {
  const tasks = await listLibraryItems({
    scope: "tasks",
    mode: "tasks",
    view: null,
    search: "",
    type: "task",
    status: "active",
    priority: "all",
    due: "all",
    category: "all"
  });

  const overdue = tasks
    .filter((item) => {
      const dueAt = dueAtTimestamp(item.task?.dueAt ?? item.dueAt);
      return dueAt !== null && dueAt < now;
    })
    .slice(0, TODAY_TASK_LIMIT);

  const dueSoon = tasks
    .filter((item) => {
      const dueAt = dueAtTimestamp(item.task?.dueAt ?? item.dueAt);
      return dueAt !== null && dueAt >= now && dueAt <= now + TODAY_DUE_SOON_WINDOW_MS;
    })
    .slice(0, TODAY_TASK_LIMIT);

  return {
    overdue,
    dueSoon
  };
}

export async function listActiveExecutiveCaptureItems(limit = 24): Promise<LibraryItemSummary[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return [];
  }

  const { client, user } = resolved;
  let data: CaptureRow[] | null = null;
  let error: CaptureLibraryQueryError | null = null;

  try {
    const response = await withSupabaseTimeout(
      client
        .from("captures")
        .select(CAPTURE_LIBRARY_SELECT)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .is("archived_at", null)
        .not("executive_work_type", "is", null)
        .order("last_active_at", { ascending: false })
        .limit(limit)
        .returns<CaptureRow[]>()
    );

    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = {
      message: requestError instanceof Error ? requestError.message : "Unknown executive capture query error."
    };
  }

  if (error || !data) {
    return [];
  }

  return data.map(mapLibrarySummary);
}

export async function appendLibraryItemUpdate(input: {
  captureId: string;
  kind: CaptureUpdateKind;
  body: string;
}): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(input.captureId);
  if (!owned.ok) {
    return owned;
  }

  const body = input.body.trim();
  if (!body) {
    return {
      ok: false,
      error: "Update text is required."
    };
  }

  const { error: insertError } = await owned.client.from("capture_updates").insert({
    capture_id: input.captureId,
    user_id: owned.user.id,
    kind: input.kind,
    body
  });

  if (insertError) {
    await setCaptureSaveState(owned.user.id, input.captureId, "error", "Update could not be appended.");
    return {
      ok: false,
      error: "Update could not be appended."
    };
  }

  const { error: touchError } = await owned.client
    .from("captures")
    .update({
      last_active_at: new Date().toISOString(),
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", input.captureId);

  if (touchError) {
    await setCaptureSaveState(owned.user.id, input.captureId, "error", "Update was saved, but activity state could not be refreshed.");
    return {
      ok: false,
      error: "Update was saved, but activity state could not be refreshed."
    };
  }

  return {
    ok: true
  };
}

export async function archiveLibraryItem(captureId: string): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(captureId);
  if (!owned.ok) {
    return owned;
  }

  const now = new Date().toISOString();
  const { error } = await owned.client
    .from("captures")
    .update({
      status: "archived",
      archived_at: now,
      last_active_at: now,
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", captureId);

  if (error) {
    await setCaptureSaveState(owned.user.id, captureId, "error", "Archive could not be saved.");
    return {
      ok: false,
      error: "Archive could not be saved."
    };
  }

  return {
    ok: true
  };
}

export async function unarchiveLibraryItem(captureId: string): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(captureId);
  if (!owned.ok) {
    return owned;
  }

  const now = new Date().toISOString();
  const { error } = await owned.client
    .from("captures")
    .update({
      status: "active",
      archived_at: null,
      last_active_at: now,
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", captureId);

  if (error) {
    await setCaptureSaveState(owned.user.id, captureId, "error", "Unarchive could not be saved.");
    return {
      ok: false,
      error: "Unarchive could not be saved."
    };
  }

  return {
    ok: true
  };
}

export async function setLibraryTaskCompletion(
  captureId: string,
  completed: boolean
): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(captureId);
  if (!owned.ok) {
    return owned;
  }

  if ((owned.capture.type ?? "note") !== "task") {
    return {
      ok: false,
      error: "Only task captures can be completed or reopened."
    };
  }

  const now = new Date().toISOString();
  const { error } = await owned.client
    .from("captures")
    .update({
      completed_at: completed ? now : null,
      last_active_at: now,
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", captureId);

  if (error) {
    await setCaptureSaveState(
      owned.user.id,
      captureId,
      "error",
      completed ? "Completion could not be saved." : "Reopen could not be saved."
    );
    return {
      ok: false,
      error: completed ? "Completion could not be saved." : "Reopen could not be saved."
    };
  }

  return {
    ok: true
  };
}

export async function deleteLibraryItem(captureId: string): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(captureId);
  if (!owned.ok) {
    return owned;
  }

  const now = new Date().toISOString();
  const { error } = await owned.client
    .from("captures")
    .update({
      deleted_at: now,
      last_active_at: now,
      save_state: "saved",
      save_state_detail: null
    })
    .eq("user_id", owned.user.id)
    .eq("id", captureId);

  if (error) {
    await setCaptureSaveState(owned.user.id, captureId, "error", "Delete could not be saved.");
    return {
      ok: false,
      error: "Delete could not be saved."
    };
  }

  return {
    ok: true
  };
}
