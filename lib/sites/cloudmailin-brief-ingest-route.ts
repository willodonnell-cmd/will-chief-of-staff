import {
  isExecutiveBriefBundleSubject,
  parseExecutiveBriefBundleEmail,
  type JsonValue
} from "@/lib/brief/executive-brief-snapshots";
import {
  createExecutiveBriefD1Repository,
  type ExecutiveBriefD1Repository
} from "@/lib/d1/executive-brief-repository";
import { sanitizeStructuredOnlyJson } from "@/lib/d1/structured-migration";
import type { D1Database } from "@/lib/d1/types";
import { parseBasicAuthHeader, parseCloudMailinRequest } from "@/lib/priority-inbox-cloudmailin";
import { resolveSitesAuthenticatedUser, type SitesAuthenticatedUser } from "@/lib/sites/authenticated-user";
import { loadRuntimeD1Database } from "@/lib/sites/runtime-d1";

export type CloudMailinBriefIngestEnv = Record<string, string | undefined> & {
  BLACKHAWK_FORWARDING_INGEST_TOKEN?: string;
  BLACKHAWK_PRIMARY_USER_EMAIL?: string;
  BLACKHAWK_PRIMARY_USER_ID?: string;
  CLOUDMAILIN_BASIC_AUTH_PASSWORD?: string;
  CLOUDMAILIN_BASIC_AUTH_USERNAME?: string;
};

export type CloudMailinBriefIngestDependencies = {
  repository?: ExecutiveBriefD1Repository;
  db?: D1Database;
  env?: CloudMailinBriefIngestEnv;
};

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init?.headers
    }
  });
}

function logCloudMailinBrief(message: string, details?: Record<string, unknown>) {
  console.info("[brief-ingest.cloudmailin]", message, details ?? {});
}

function configuredBasicAuth(env: CloudMailinBriefIngestEnv) {
  const username = env.CLOUDMAILIN_BASIC_AUTH_USERNAME?.trim();
  const password = env.CLOUDMAILIN_BASIC_AUTH_PASSWORD?.trim();
  return username && password ? { username, password } : null;
}

function configuredToken(env: CloudMailinBriefIngestEnv) {
  return env.BLACKHAWK_FORWARDING_INGEST_TOKEN?.trim() || null;
}

function isCloudMailinAuthorized(request: Request, env: CloudMailinBriefIngestEnv) {
  const basicAuth = configuredBasicAuth(env);
  if (basicAuth) {
    const provided = parseBasicAuthHeader(request);
    return provided?.username === basicAuth.username && provided.password === basicAuth.password;
  }

  const token = configuredToken(env);
  if (token) {
    return request.headers.get("x-blackhawk-ingest-token")?.trim() === token;
  }

  return true;
}

function messageIdFromHeaders(headers: Record<string, string | string[] | null | undefined> | undefined) {
  if (!headers) {
    return null;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "message-id") {
      continue;
    }

    return Array.isArray(value) ? value.find((entry) => entry.trim()) ?? null : value ?? null;
  }

  return null;
}

function diagnostics(input: {
  subject?: string | null;
  sender?: string | null;
  messageId?: string | null;
  jsonBundleParsed?: boolean;
  validationWarnings?: string[];
  snapshotId?: string;
  failureReason?: string;
}) {
  return Object.fromEntries(Object.entries({
    subject: input.subject ?? null,
    sender: input.sender ?? null,
    messageId: input.messageId ?? null,
    jsonBundleParsed: input.jsonBundleParsed,
    validationWarnings: input.validationWarnings,
    snapshotId: input.snapshotId,
    failureReason: input.failureReason
  }).filter(([, value]) => value !== undefined));
}

function resolvePrimaryUser(request: Request, env: CloudMailinBriefIngestEnv): SitesAuthenticatedUser | null {
  return resolveSitesAuthenticatedUser(request.headers, env);
}

export async function handleCloudMailinBriefIngestRequest(
  request: Request,
  dependencies: CloudMailinBriefIngestDependencies = {}
) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  }

  const env = dependencies.env ?? process.env;
  if (!isCloudMailinAuthorized(request, env)) {
    logCloudMailinBrief("Rejected CloudMailIn Executive Brief webhook because auth failed.", {
      contentType: request.headers.get("content-type") ?? null
    });
    return jsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  const parsedRequest = await parseCloudMailinRequest(request);
  if (!parsedRequest.ok) {
    logCloudMailinBrief("Rejected CloudMailIn Executive Brief webhook because payload parsing failed.", {
      contentType: parsedRequest.contentType ?? null,
      failureReason: parsedRequest.error
    });
    return jsonResponse({ error: "invalid_cloudmailin_payload", message: parsedRequest.error }, { status: parsedRequest.status });
  }

  const input = parsedRequest.input;
  const baseDiagnostics = {
    subject: input.subject,
    sender: input.forwardedByEmail ?? input.forwardedByName ?? null,
    messageId: messageIdFromHeaders(input.headers ?? undefined)
  };
  logCloudMailinBrief("Received CloudMailIn Executive Brief webhook.", diagnostics(baseDiagnostics));

  if (!isExecutiveBriefBundleSubject(input.subject)) {
    logCloudMailinBrief("Ignored CloudMailIn webhook with non-Executive Brief subject.", {
      ...diagnostics(baseDiagnostics),
      failureReason: "unsupported_subject"
    });
    return jsonResponse({ ok: false, error: "unsupported_subject" }, { status: 202 });
  }

  const user = resolvePrimaryUser(request, env);
  if (!user) {
    logCloudMailinBrief("Rejected CloudMailIn Executive Brief webhook because primary user is not configured.", {
      ...diagnostics(baseDiagnostics),
      failureReason: "primary_user_required"
    });
    return jsonResponse({ error: "primary_user_required" }, { status: 503 });
  }

  const parsedBrief = parseExecutiveBriefBundleEmail(input);
  const parsedDiagnostics = diagnostics({
    ...baseDiagnostics,
    messageId: parsedBrief.sourceMessageId ?? baseDiagnostics.messageId,
    jsonBundleParsed: Boolean(parsedBrief.jsonBundle),
    validationWarnings: parsedBrief.validationWarnings
  });
  logCloudMailinBrief("Parsed CloudMailIn Executive Brief bundle.", parsedDiagnostics);

  if (!parsedBrief.structuredBrief) {
    logCloudMailinBrief("Rejected CloudMailIn Executive Brief bundle because structured JSON was missing or invalid.", {
      ...parsedDiagnostics,
      failureReason: "structured_brief_required"
    });
    return jsonResponse(
      {
        error: "structured_brief_required",
        validationWarnings: parsedBrief.validationWarnings
      },
      { status: 422 }
    );
  }

  const db = dependencies.db ?? await loadRuntimeD1Database();
  const repository = dependencies.repository ?? (db ? createExecutiveBriefD1Repository(db) : null);
  if (!repository) {
    logCloudMailinBrief("Rejected CloudMailIn Executive Brief bundle because D1 is unavailable.", {
      ...parsedDiagnostics,
      failureReason: "d1_binding_unavailable"
    });
    return jsonResponse({ error: "d1_binding_unavailable" }, { status: 503 });
  }

  const sanitizedJsonBundle = sanitizeStructuredOnlyJson(parsedBrief.jsonBundle);
  const sanitizedStructuredBrief = sanitizeStructuredOnlyJson(parsedBrief.structuredBrief as unknown as JsonValue);
  const validationWarnings = [
    ...parsedBrief.validationWarnings,
    ...sanitizedJsonBundle.excludedColumns.map((column) => `Excluded unsafe JSON bundle field: ${column}`),
    ...sanitizedStructuredBrief.excludedColumns.map((column) => `Excluded unsafe structured brief field: ${column}`)
  ];

  await repository.ensureUser({
    userId: user.id,
    email: user.email,
    displayName: user.displayName
  });
  const snapshot = await repository.upsertSnapshot({
    userId: user.id,
    subject: parsedBrief.subject,
    slot: parsedBrief.slot,
    generatedAt: parsedBrief.generatedAt,
    displayDate: parsedBrief.displayDate,
    humanBrief: parsedBrief.humanBrief,
    jsonBundle: sanitizedJsonBundle.value,
    structuredBrief: sanitizedStructuredBrief.value as typeof parsedBrief.structuredBrief,
    contractVersion: parsedBrief.contractVersion,
    validationWarnings,
    sourceMessageId: parsedBrief.sourceMessageId,
    sourceRunId: null,
    sourceKind: "cloudmailin_fallback"
  });
  const taskCandidateCount = await repository.upsertTaskCandidates({
    userId: user.id,
    snapshotId: snapshot.id,
    items: snapshot.structuredBrief?.taskCandidates ?? []
  });

  logCloudMailinBrief("Persisted CloudMailIn Executive Brief snapshot to D1.", {
    ...parsedDiagnostics,
    snapshotId: snapshot.id
  });

  return jsonResponse(
    {
      ok: true,
      kind: "executive_brief",
      snapshotId: snapshot.id,
      slot: snapshot.slot,
      generatedAt: snapshot.generatedAt,
      taskCandidateCount,
      taskPersistence: "candidate_only",
      validationWarnings
    },
    { status: 201 }
  );
}
