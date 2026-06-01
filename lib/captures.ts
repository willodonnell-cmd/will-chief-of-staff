import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";
import { execFile } from "node:child_process";
import {
  buildNoteWorkingContent,
  buildTaskWorkingContent,
  computeNoteDisplayTitle,
  computeTaskDisplayTitle,
  type BlackhawkCaptureInput as CaptureInput,
  type CapturePattern,
  type CapturePrivacy,
  type ExecutiveCaptureMetadata
} from "@/lib/blackhawk-capture-model";
import type { ExecutiveWorkType } from "@/lib/executive-work";

export type { CaptureInput };

type CaptureRecord = {
  id: string;
  source_path: string | null;
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  follow_up: string | null;
  private_context: string | null;
  captured_at: string;
  due_at?: string | null;
  executive_work_type?: ExecutiveWorkType | null;
  capture_metadata?: ExecutiveCaptureMetadata | null;
};

type CaptureWriteError = {
  message?: string;
  details?: string;
  code?: string;
  hint?: string;
};

export type SavedCapture = {
  id: string;
  sourcePath: string | null;
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  followUp: string;
  privateContext: string;
  capturedAt: string;
  dueAt: string | null;
  executiveWorkType: ExecutiveWorkType | null;
  executiveMetadata: ExecutiveCaptureMetadata | null;
};

export type SaveCaptureResult =
  | {
      ok: true;
      capture: SavedCapture;
    }
  | {
      ok: false;
      error: string;
};

type CaptureInsertContext = {
  linkedInitiativeId: string | null;
  linkedInitiativeTitle: string | null;
  taskCategoryId: string | null;
  taskCategoryName: string | null;
};

function mapCapture(record: CaptureRecord): SavedCapture {
  return {
    id: record.id,
    sourcePath: record.source_path,
    pattern: record.pattern,
    privacy: record.privacy,
    summary: record.summary,
    followUp: record.follow_up ?? "",
    privateContext: record.private_context ?? "",
    capturedAt: record.captured_at,
    dueAt: record.due_at ?? null,
    executiveWorkType: record.executive_work_type ?? null,
    executiveMetadata: record.capture_metadata ?? null
  };
}

function describeCaptureWriteFailure(
  error: CaptureWriteError | null | undefined,
  curlRestMessage?: string | null
) {
  const combined = `${error?.message ?? ""}\n${error?.details ?? ""}`;
  const lowered = combined.toLowerCase();
  const curlLower = (curlRestMessage ?? "").toLowerCase();

  if (curlLower.includes("invalid api key")) {
    return "Supabase rejected the API key. Use the service role key and project URL from the same Supabase project (Dashboard → Settings → API).";
  }

  if (
    lowered.includes("self_signed_cert") ||
    lowered.includes("self-signed certificate") ||
    lowered.includes("self_signed_cert_in_chain")
  ) {
    return "Could not reach Supabase over HTTPS because of a certificate trust issue (often corporate SSL inspection). For local dev only, add SUPABASE_DEV_ALLOW_INSECURE_TLS=true to .env.local and restart the dev server; or trust your organization's root CA (for example NODE_EXTRA_CA_CERTS).";
  }

  if (!combined.trim()) {
    return "Capture could not be saved.";
  }

  if (
    combined.includes('relation "captures" does not exist') ||
    combined.includes('column "type" of relation "captures" does not exist')
  ) {
    return "Capture storage is not ready yet. Run the latest Supabase migration.";
  }

  if (lowered.includes("permission denied") || lowered.includes("row-level security")) {
    return "Capture storage is unavailable for the current session.";
  }

  return "Capture could not be saved to Supabase right now.";
}

function logCaptureSave(message: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[capture.save]", message, details ?? {});
}

function shouldUseCurlFallback(error: CaptureWriteError | null | undefined) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const errorText = `${error?.message ?? ""}\n${error?.details ?? ""}`.toLowerCase();
  return (
    errorText.includes("self_signed_cert_in_chain") ||
    errorText.includes("self-signed certificate in certificate chain") ||
    errorText.includes("fetch failed") ||
    errorText.includes("connect timeout") ||
    errorText.includes("und_err_connect_timeout") ||
    errorText.includes("supabase request timed out")
  );
}

function shouldRetryLegacyCaptureInsert(error: CaptureWriteError | null | undefined) {
  const errorText = `${error?.message ?? ""}\n${error?.details ?? ""}`.toLowerCase();

  /** Hosted Supabase uses PostgREST — unknown columns surface as PGRST204 + schema cache message. */
  const postgrestMissingLibraryColumn =
    error?.code === "PGRST204" &&
    errorText.includes("could not find") &&
    errorText.includes("captures") &&
    errorText.includes("schema cache");

  return (
    postgrestMissingLibraryColumn ||
    errorText.includes('column "type" of relation "captures" does not exist') ||
    errorText.includes('column "title" of relation "captures" does not exist') ||
    errorText.includes('column "original_content" of relation "captures" does not exist') ||
    errorText.includes('column "working_content" of relation "captures" does not exist') ||
    errorText.includes('column "last_active_at" of relation "captures" does not exist') ||
    errorText.includes('column "save_state" of relation "captures" does not exist') ||
    errorText.includes('column "note_body" of relation "captures" does not exist') ||
    errorText.includes('column "task_description" of relation "captures" does not exist') ||
    errorText.includes('column "task_category_id" of relation "captures" does not exist') ||
    errorText.includes('column "linked_initiative_id" of relation "captures" does not exist') ||
    errorText.includes('column "executive_work_type" of relation "captures" does not exist') ||
    errorText.includes('column "capture_metadata" of relation "captures" does not exist')
  );
}

function buildLegacySummary(input: CaptureInput) {
  if (input.pattern === "note") {
    return {
      summary: input.note.body.trim(),
      followUp: input.note.title.trim(),
      title: computeNoteDisplayTitle(input.note.title, input.note.body)
    };
  }

  const followUpSections = [input.task.nextStep.trim(), input.task.desiredOutcome.trim()].filter(Boolean);

  return {
    summary: input.task.description.trim(),
    followUp: followUpSections.join("\n\n"),
    title: computeTaskDisplayTitle(input.task.description)
  };
}

function buildOriginalContent(input: CaptureInput, context: CaptureInsertContext) {
  const mainContent =
    input.pattern === "note"
      ? buildNoteWorkingContent(input.note)
      : buildTaskWorkingContent(input.task, {
          categoryName: context.taskCategoryName,
          initiativeTitle: context.linkedInitiativeTitle
        });

  const sections = [mainContent];

  if (input.privateContext.trim()) {
    sections.push(`Private context:\n${input.privateContext.trim()}`);
  }

  return sections.filter(Boolean).join("\n\n");
}

function buildCaptureInsertPayload(input: CaptureInput, context: CaptureInsertContext, includeLibraryFields: boolean) {
  const legacy = buildLegacySummary(input);
  const dueAt = input.pattern === "task" ? input.task.dueAt ?? input.dueAt ?? null : input.dueAt ?? null;
  const basePayload = {
    source_path: input.sourcePath,
    pattern: input.pattern,
    privacy: input.privacy,
    summary: legacy.summary,
    follow_up: legacy.followUp || null,
    private_context: input.privateContext || null
  };

  if (!includeLibraryFields) {
    return basePayload;
  }

  const originalContent = buildOriginalContent(input, context);
  const now = new Date().toISOString();

  return {
    ...basePayload,
    type: input.pattern,
    title: legacy.title,
    original_content: originalContent,
    working_content: originalContent,
    last_active_at: now,
    note_title: input.pattern === "note" ? input.note.title.trim() || null : null,
    note_body: input.pattern === "note" ? input.note.body.trim() : null,
    task_description: input.pattern === "task" ? input.task.description.trim() : null,
    task_next_step: input.pattern === "task" ? input.task.nextStep.trim() || null : null,
    task_desired_outcome: input.pattern === "task" ? input.task.desiredOutcome.trim() || null : null,
    task_category_id: input.pattern === "task" ? context.taskCategoryId : null,
    linked_initiative_id: context.linkedInitiativeId,
    due_at: dueAt,
    priority: input.pattern === "task" ? input.task.priority : null,
    executive_work_type: input.executiveWorkType ?? null,
    capture_metadata: input.executiveMetadata ?? {},
    save_state: "saved" as const
  };
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

async function insertCaptureViaCurlFallback(
  userId: string,
  input: CaptureInput,
  context: CaptureInsertContext
): Promise<[SavedCapture | null, string | null]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !apiKey) {
    logCaptureSave("curl fallback could not start because Supabase env vars are missing.", {
      hasUrl: Boolean(url),
      hasApiKey: Boolean(apiKey)
    });
    return [null, null];
  }

  const payload = JSON.stringify({
    user_id: userId,
    ...buildCaptureInsertPayload(input, context, true)
  });

  try {
    const { stdout, stderr } = await execFileAsync("curl", [
      "-sk",
      "-X",
      "POST",
      `${url}/rest/v1/captures`,
      "-H",
      `apikey: ${apiKey}`,
      "-H",
      `Authorization: Bearer ${apiKey}`,
      "-H",
      "Content-Type: application/json",
      "-H",
      "Prefer: return=representation",
      "-d",
      payload
    ]);

    if (stderr.trim()) {
      logCaptureSave("curl fallback emitted stderr while saving capture.", {
        stderr: stderr.trim()
      });
    }

    const parsed = JSON.parse(stdout) as CaptureRecord[] | { message?: string; hint?: string };
    const record = Array.isArray(parsed) ? parsed[0] : null;

    if (record) {
      logCaptureSave("Supabase capture save succeeded via curl fallback.", {
        userId,
        captureId: record.id
      });
      return [mapCapture(record), null];
    }

    const restMessage =
      typeof parsed === "object" && parsed !== null && "message" in parsed
        ? String((parsed as { message?: string }).message ?? "")
        : "";
    logCaptureSave("curl fallback returned an error payload from Supabase REST.", {
      stdout,
      restMessage: restMessage || null
    });
    return [null, restMessage || stdout.trim() || null];
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    logCaptureSave("curl fallback failed while saving capture.", {
      userId,
      errorMessage: failure.message,
      stdout: failure.stdout ?? null,
      stderr: failure.stderr ?? null
    });
    return [null, null];
  }
}

async function resolveCaptureInsertContext(
  userId: string,
  client: NonNullable<Awaited<ReturnType<typeof resolveCurrentAppUser>>>["client"],
  input: CaptureInput
): Promise<CaptureInsertContext | null> {
  const linkedInitiativeId =
    input.pattern === "note" ? input.note.linkedInitiativeId : input.task.linkedInitiativeId;

  let linkedInitiativeTitle: string | null = null;
  if (linkedInitiativeId) {
    const { data } = await client
      .from("initiatives")
      .select("id, title")
      .eq("user_id", userId)
      .eq("id", linkedInitiativeId)
      .maybeSingle<{ id: string; title: string }>();

    linkedInitiativeTitle = data?.title ?? null;
  }

  if (input.pattern === "note") {
    return {
      linkedInitiativeId: linkedInitiativeTitle ? linkedInitiativeId : null,
      linkedInitiativeTitle,
      taskCategoryId: null,
      taskCategoryName: null
    };
  }

  const { data: categories } = await client
    .from("task_categories")
    .select("id, name, status, is_fallback, sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .returns<Array<{ id: string; name: string; status: "active" | "inactive"; is_fallback: boolean; sort_order: number }>>();

  const activeCategories = (categories ?? []).filter((category) => category.status === "active");
  const fallbackCategory =
    activeCategories.find((category) => category.is_fallback) ??
    activeCategories.find((category) => category.name.trim().toLowerCase() === "tbd") ??
    null;
  const selectedCategory =
    activeCategories.find((category) => category.id === input.task.categoryId) ?? fallbackCategory ?? null;

  if (!selectedCategory) {
    return null;
  }

  return {
    linkedInitiativeId: linkedInitiativeTitle ? linkedInitiativeId : null,
    linkedInitiativeTitle,
    taskCategoryId: selectedCategory.id,
    taskCategoryName: selectedCategory.name
  };
}

export async function saveCapture(input: CaptureInput): Promise<SaveCaptureResult> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    logCaptureSave("No current app user could be resolved for capture save.");
    return {
      ok: false,
      error: "No active app user could be resolved for capture."
    };
  }

  const adminClient = createSupabaseAdminClient();
  if (resolved.source === "bootstrap" && !adminClient) {
    logCaptureSave(
      "Bootstrap capture save blocked: RLS requires the service role client when there is no Supabase session.",
      { userId: resolved.user.id }
    );
    return {
      ok: false,
      error:
        "Local bootstrap mode cannot save captures without SUPABASE_SERVICE_ROLE_KEY in .env.local. Add the server-only key from your Supabase project, or sign in so your session matches a row in public.users."
    };
  }

  const { client, user } = resolved;
  logCaptureSave("Attempting Supabase capture save.", {
    userId: user.id,
    email: user.email,
    source: resolved.source,
    sourcePath: input.sourcePath,
    pattern: input.pattern,
    privacy: input.privacy
  });
  const insertContext = await resolveCaptureInsertContext(user.id, client, input);
  if (!insertContext) {
    return {
      ok: false,
      error: "Task categories are not configured yet. Run the latest migration and ensure the fallback TBD category exists."
    };
  }

  let { data, error } = await client
    .from("captures")
    .insert({
      user_id: user.id,
      ...buildCaptureInsertPayload(input, insertContext, true)
    })
    .select(
      "id, source_path, pattern, privacy, summary, follow_up, private_context, captured_at, due_at, executive_work_type, capture_metadata"
    )
    .single<CaptureRecord>();

  if (error && shouldRetryLegacyCaptureInsert(error)) {
    logCaptureSave("Retrying capture save against the legacy capture schema.", {
      userId: user.id,
      email: user.email,
      source: resolved.source,
      errorMessage: error.message
    });

    const legacyInsert = await client
      .from("captures")
      .insert({
        user_id: user.id,
        ...buildCaptureInsertPayload(input, insertContext, false)
      })
      .select("id, source_path, pattern, privacy, summary, follow_up, private_context, captured_at")
      .single<CaptureRecord>();

    data = legacyInsert.data;
    error = legacyInsert.error;
  }

  if (error || !data) {
    logCaptureSave("Supabase capture save failed.", {
      userId: user.id,
      email: user.email,
      source: resolved.source,
      errorMessage: error?.message ?? null,
      errorCode: error?.code ?? null,
      errorDetails: error?.details ?? null,
      errorHint: error?.hint ?? null
    });

    if (shouldUseCurlFallback(error)) {
      const [fallbackCapture, curlRestMessage] = await insertCaptureViaCurlFallback(user.id, input, insertContext);
      if (fallbackCapture) {
        return {
          ok: true,
          capture: fallbackCapture
        };
      }
      return {
        ok: false,
        error: describeCaptureWriteFailure(error, curlRestMessage)
      };
    }

    return {
      ok: false,
      error: describeCaptureWriteFailure(error)
    };
  }

  logCaptureSave("Supabase capture save succeeded.", {
    userId: user.id,
    email: user.email,
    source: resolved.source,
    captureId: data.id
  });
  return {
    ok: true,
    capture: mapCapture(data)
  };
}

export async function getRecentCaptures(limit = 10): Promise<SavedCapture[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return [];
  }

  const { client, user } = resolved;
  let data: CaptureRecord[] | null = null;
  let error: { message: string } | null = null;

  try {
    const response = await withSupabaseTimeout(
      client
        .from("captures")
        .select("id, source_path, pattern, privacy, summary, follow_up, private_context, captured_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("captured_at", { ascending: false })
        .limit(limit)
        .returns<CaptureRecord[]>()
    );

    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = {
      message: requestError instanceof Error ? requestError.message : "Unknown recent captures error."
    };
  }

  if (error || !data) {
    return [];
  }

  return data.map(mapCapture);
}
