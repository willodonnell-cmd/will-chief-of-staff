import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import { execFile } from "node:child_process";

export type LibraryItemType = "note" | "task";
export type LibraryItemStatus = "active" | "completed" | "archived";
export type CaptureUpdateKind = "update" | "comment";
export type CaptureSaveState = "saved" | "pending" | "error";
export type LibraryScope = "library" | "tasks" | "archived";
export type LibraryTypeFilter = "all" | LibraryItemType;
export type LibraryStatusFilter = "all" | Exclude<LibraryItemStatus, "archived">;
export type LibraryDueFilter = "all" | "overdue" | "upcoming" | "none";
export type LibraryTaskStatus = "active" | "completed";
export type LibraryTaskPriority = "low" | "medium" | "high";

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
  original_content: string;
  working_content: string;
  captured_at: string;
  last_active_at: string;
  archived_at: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  due_at: string | null;
  priority?: LibraryTaskPriority | null;
  save_state: CaptureSaveState;
  save_state_detail: string | null;
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
  type: LibraryItemType | null;
  title: string;
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
  status: LibraryTaskStatus;
  dueAt: string | null;
  priority: LibraryTaskPriority | null;
};

export type LibraryItemSummary = {
  id: string;
  type: LibraryItemType;
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
  task: LibraryTaskData | null;
};

export type LibraryItemDetail = LibraryItemSummary & {
  originalContent: string;
  workingContent: string;
  updates: CaptureUpdateEntry[];
};

export type LibraryQuery = {
  scope: LibraryScope;
  search: string;
  type: LibraryTypeFilter;
  status: LibraryStatusFilter;
  due: LibraryDueFilter;
};

export type LibraryMutationResult =
  | {
      ok: true;
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
  original_content,
  working_content,
  captured_at,
  last_active_at,
  archived_at,
  completed_at,
  deleted_at,
  due_at,
  priority,
  save_state,
  save_state_detail,
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
  "original_content",
  "working_content",
  "captured_at",
  "last_active_at",
  "archived_at",
  "completed_at",
  "deleted_at",
  "due_at",
  "priority",
  "save_state",
  "save_state_detail"
].join(",");

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

function isLibraryType(value: string | undefined): value is LibraryItemType {
  return value === "note" || value === "task";
}

function isLibraryStatus(value: string | undefined): value is LibraryStatusFilter {
  return value === "active" || value === "completed";
}

function isLibraryDue(value: string | undefined): value is LibraryDueFilter {
  return value === "overdue" || value === "upcoming" || value === "none" || value === "all";
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

function buildPreview(workingContent: string, originalContent: string) {
  const source = workingContent.trim() || originalContent.trim();
  const collapsed = source.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return "No working content yet.";
  }

  if (collapsed.length <= 180) {
    return collapsed;
  }

  return `${collapsed.slice(0, 177).trimEnd()}...`;
}

function mapUpdateEntry(row: CaptureUpdateRow): CaptureUpdateEntry {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at
  };
}

function mapLibrarySummary(row: CaptureRow): LibraryItemSummary {
  const type = mapRowType(row);
  const status = getLibraryStatus(row);
  const saveStateDetail = row.save_state_detail ?? "";
  const priority = isLibraryTaskPriority(row.priority) ? row.priority : null;

  return {
    id: row.id,
    type,
    title: row.title,
    preview: buildPreview(row.working_content, row.original_content),
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
    task:
      type === "task"
        ? {
            title: row.title,
            status: getTaskStatus(row.completed_at),
            dueAt: row.due_at,
            priority
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

function matchesSearch(row: CaptureRow, search: string) {
  if (!search) {
    return true;
  }

  const haystack = [
    row.title,
    row.original_content,
    row.working_content,
    ...(row.capture_updates ?? []).map((entry) => entry.body)
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(search);
}

function dueRank(item: LibraryItemSummary, now: number) {
  if (item.type !== "task") {
    return 99;
  }

  if (item.status === "completed") {
    return 4;
  }

  if (!item.dueAt) {
    return 3;
  }

  return Date.parse(item.dueAt) < now ? 1 : 2;
}

function compareByLastActive(left: LibraryItemSummary, right: LibraryItemSummary) {
  return Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt);
}

function sortLibraryItems(items: LibraryItemSummary[], scope: LibraryScope) {
  if (scope !== "tasks") {
    return [...items].sort(compareByLastActive);
  }

  const now = Date.now();

  return [...items].sort((left, right) => {
    const leftRank = dueRank(left, now);
    const rightRank = dueRank(right, now);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (leftRank === 1 || leftRank === 2) {
      const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.POSITIVE_INFINITY;
      const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.POSITIVE_INFINITY;

      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }
    }

    return compareByLastActive(left, right);
  });
}

function matchesType(item: LibraryItemSummary, filter: LibraryTypeFilter) {
  return filter === "all" ? true : item.type === filter;
}

function matchesStatus(item: LibraryItemSummary, filter: LibraryStatusFilter, scope: LibraryScope) {
  if (scope === "archived") {
    return item.status === "archived";
  }

  if (filter === "all") {
    return true;
  }

  return item.status === filter;
}

function matchesDue(item: LibraryItemSummary, filter: LibraryDueFilter) {
  if (item.type !== "task" || filter === "all") {
    return true;
  }

  const dueAt = item.dueAt ? Date.parse(item.dueAt) : null;

  if (filter === "none") {
    return dueAt === null;
  }

  if (item.status === "completed" || dueAt === null) {
    return false;
  }

  if (filter === "overdue") {
    return dueAt < Date.now();
  }

  return dueAt >= Date.now();
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
  if (!normalized) {
    return {
      ok: true as const,
      value: null
    };
  }

  if (isLibraryTaskPriority(normalized)) {
    return {
      ok: true as const,
      value: normalized
    };
  }

  return {
    ok: false as const,
    error: "Task priority must be low, medium, or high."
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
    .select("id, user_id, type, title, archived_at, completed_at, deleted_at")
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
  const search = firstValue(raw.search)?.trim() ?? "";
  const type = firstValue(raw.type);
  const status = firstValue(raw.status);
  const due = firstValue(raw.due);

  return {
    scope,
    search,
    type: scope === "tasks" ? "task" : isLibraryType(type) ? type : "all",
    status: scope === "archived" ? "all" : isLibraryStatus(status) ? status : "all",
    due: scope === "tasks" && isLibraryDue(due) ? due : "all"
  };
}

export async function listLibraryItems(query: LibraryQuery): Promise<LibraryItemSummary[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return [];
  }

  const { client, user } = resolved;
  function buildScopedCaptureListRequest(selectClause: string) {
    let request = client
      .from("captures")
      .select(selectClause)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (query.scope === "archived") {
      request = request.not("archived_at", "is", null);
    } else {
      request = request.is("archived_at", null);
    }

    if (query.scope === "tasks") {
      request = request.eq("type", "task");
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
      archivedFilter: query.scope === "archived" ? "only" : "exclude",
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
    return [];
  }

  const normalizedSearch = normalizeSearchText(query.search);

  const filtered = data
    .filter((row) => matchesSearch(row, normalizedSearch))
    .map(mapLibrarySummary)
    .filter((item) => matchesType(item, query.type))
    .filter((item) => matchesStatus(item, query.status, query.scope))
    .filter((item) => matchesDue(item, query.due));

  return sortLibraryItems(filtered, query.scope);
}

export async function getLibraryItemDetail(captureId: string): Promise<LibraryItemDetail | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const { client, user } = resolved;
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
}): Promise<LibraryMutationResult> {
  const owned = await getOwnedCapture(input.captureId);
  if (!owned.ok) {
    return owned;
  }

  const title = (input.title ?? owned.capture.title).trim();
  if (!title) {
    return {
      ok: false,
      error: "Title is required."
    };
  }
  const { error } = await owned.client
    .from("captures")
    .update({
      title,
      working_content: input.workingContent,
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
  title: string;
  status: string;
  dueAt?: string | null;
  priority?: string | null;
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

  const title = input.title.trim();
  if (!title) {
    return {
      ok: false,
      error: "Title is required."
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

  const now = new Date().toISOString();
  const { error } = await owned.client
    .from("captures")
    .update({
      title,
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
    search: "",
    type: "task",
    status: "active",
    due: "all"
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
