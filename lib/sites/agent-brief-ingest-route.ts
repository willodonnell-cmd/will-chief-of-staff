import {
  EXECUTIVE_BRIEF_BUNDLE_SUBJECT_PREFIX,
  EXECUTIVE_BRIEF_SLOT_LABELS,
  normalizeExecutiveBriefJsonBundle,
  type ExecutiveBriefSlotLabel,
  type JsonRecord,
  type JsonValue,
  type StructuredExecutiveBrief
} from "@/lib/brief/executive-brief-snapshots";
import {
  createExecutiveBriefD1Repository,
  type ExecutiveBriefD1Repository
} from "@/lib/d1/executive-brief-repository";
import { sanitizeStructuredOnlyJson } from "@/lib/d1/structured-migration";
import type { D1Database } from "@/lib/d1/types";
import { resolveSitesAuthenticatedUser, type SitesAuthenticatedUser } from "@/lib/sites/authenticated-user";

export type AgentBriefIngestDependencies = {
  repository?: ExecutiveBriefD1Repository;
  db?: D1Database;
  now?: () => Date;
  maxRequestBytes?: number;
};

type AgentBriefIngestPayload = {
  subject?: unknown;
  slot?: unknown;
  generatedAt?: unknown;
  generated_at?: unknown;
  displayDate?: unknown;
  display_date?: unknown;
  humanBrief?: unknown;
  human_brief?: unknown;
  jsonBundle?: unknown;
  json_bundle?: unknown;
  structuredBrief?: unknown;
  structured_brief?: unknown;
  contractVersion?: unknown;
  contract_version?: unknown;
  validationWarnings?: unknown;
  validation_warnings?: unknown;
  sourceMessageId?: unknown;
  source_message_id?: unknown;
  sourceRunId?: unknown;
  source_run_id?: unknown;
};

type GlobalWithD1 = typeof globalThis & {
  DB?: D1Database;
  __BLACKHAWK_D1_DB__?: D1Database;
};

type BoundedJsonPayloadResult =
  | { payload: AgentBriefIngestPayload }
  | { error: "payload_too_large" | "invalid_json" };

export const DEFAULT_AGENT_BRIEF_INGEST_MAX_BYTES = 256 * 1024;

function runtimeD1Database() {
  const globalWithD1 = globalThis as GlobalWithD1;
  return globalWithD1.__BLACKHAWK_D1_DB__ ?? globalWithD1.DB ?? null;
}

function jsonResponse(body: JsonRecord, init?: ResponseInit) {
  return Response.json(body, init);
}

function normalizeOneLine(value: unknown) {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : null;
}

function parseDateLike(value: unknown) {
  const text = normalizeOneLine(value);
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && isJsonValue(value));
}

function normalizeSlot(value: unknown): ExecutiveBriefSlotLabel {
  const text = normalizeOneLine(value);
  const slot = EXECUTIVE_BRIEF_SLOT_LABELS.find((label) => label.toLowerCase() === text?.toLowerCase());
  return slot ?? "Manual";
}

function normalizeWarnings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeOneLine).filter((entry): entry is string => Boolean(entry));
}

function pickJsonBundle(payload: AgentBriefIngestPayload): JsonValue | null {
  const explicitBundle = payload.jsonBundle ?? payload.json_bundle;
  if (isJsonValue(explicitBundle)) {
    return explicitBundle;
  }

  if (isJsonRecord(payload)) {
    return payload;
  }

  return null;
}

function pickStructuredBrief(payload: AgentBriefIngestPayload, jsonBundle: JsonValue | null): StructuredExecutiveBrief | null {
  const explicitStructuredBrief = payload.structuredBrief ?? payload.structured_brief;
  if (isJsonValue(explicitStructuredBrief)) {
    return normalizeExecutiveBriefJsonBundle(explicitStructuredBrief).structuredBrief;
  }

  return normalizeExecutiveBriefJsonBundle(jsonBundle).structuredBrief;
}

function hasAgentIngestAuthorization(request: Request, user: SitesAuthenticatedUser | null) {
  const expectedSecret = process.env.BLACKHAWK_AGENT_INGEST_SECRET?.trim();
  const providedSecret = request.headers.get("x-blackhawk-agent-ingest-secret")?.trim();
  const secretAllowed = Boolean(expectedSecret && providedSecret && expectedSecret === providedSecret);
  const workspaceAuthAllowed = process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST !== "false" && Boolean(user);
  return secretAllowed || workspaceAuthAllowed;
}

async function readBoundedJsonPayload(
  request: Request,
  maxRequestBytes: number
): Promise<BoundedJsonPayloadResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxRequestBytes) {
    return { error: "payload_too_large" as const };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxRequestBytes) {
    return { error: "payload_too_large" as const };
  }

  try {
    return { payload: JSON.parse(rawBody) as AgentBriefIngestPayload };
  } catch {
    return { error: "invalid_json" as const };
  }
}

export async function handleAgentBriefIngestRequest(request: Request, dependencies: AgentBriefIngestDependencies = {}) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  }

  const user = resolveSitesAuthenticatedUser(request.headers);
  if (!hasAgentIngestAuthorization(request, user)) {
    return jsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  if (!user) {
    return jsonResponse({ error: "authenticated_user_required" }, { status: 401 });
  }

  const parsedPayload = await readBoundedJsonPayload(
    request,
    dependencies.maxRequestBytes ?? DEFAULT_AGENT_BRIEF_INGEST_MAX_BYTES
  );
  if (!("payload" in parsedPayload)) {
    const error = parsedPayload.error;
    return jsonResponse(
      { error },
      { status: error === "payload_too_large" ? 413 : 400 }
    );
  }
  const payload = parsedPayload.payload;

  const db = dependencies.db ?? runtimeD1Database();
  const repository = dependencies.repository ?? (db ? createExecutiveBriefD1Repository(db) : null);
  if (!repository) {
    return jsonResponse({ error: "d1_binding_unavailable" }, { status: 503 });
  }

  const jsonBundle = pickJsonBundle(payload);
  const structuredBrief = pickStructuredBrief(payload, jsonBundle);
  if (!structuredBrief) {
    return jsonResponse({ error: "structured_brief_required" }, { status: 422 });
  }

  const sanitizedJsonBundle = sanitizeStructuredOnlyJson(jsonBundle);
  const sanitizedStructuredBrief = sanitizeStructuredOnlyJson(structuredBrief as unknown as JsonValue);
  const normalizedBundle = normalizeExecutiveBriefJsonBundle(sanitizedJsonBundle.value);
  const generatedAt = parseDateLike(payload.generatedAt ?? payload.generated_at) ?? dependencies.now?.().toISOString() ?? new Date().toISOString();

  await repository.ensureUser({
    userId: user.id,
    email: user.email,
    displayName: user.displayName
  });
  const snapshot = await repository.upsertSnapshot({
    userId: user.id,
    subject: normalizeOneLine(payload.subject) ?? `${EXECUTIVE_BRIEF_BUNDLE_SUBJECT_PREFIX} ${normalizeSlot(payload.slot)}`,
    slot: normalizeSlot(payload.slot ?? (isJsonRecord(jsonBundle) ? jsonBundle.slot : null)),
    generatedAt,
    displayDate: normalizeOneLine(payload.displayDate ?? payload.display_date),
    humanBrief: normalizeOneLine(payload.humanBrief ?? payload.human_brief),
    jsonBundle: sanitizedJsonBundle.value,
    structuredBrief: sanitizedStructuredBrief.value as unknown as StructuredExecutiveBrief,
    contractVersion:
      normalizeOneLine(payload.contractVersion ?? payload.contract_version) ?? normalizedBundle.contractVersion,
    validationWarnings: [
      ...normalizeWarnings(payload.validationWarnings ?? payload.validation_warnings),
      ...normalizedBundle.validationWarnings
    ],
    sourceMessageId: normalizeOneLine(payload.sourceMessageId ?? payload.source_message_id),
    sourceRunId: normalizeOneLine(payload.sourceRunId ?? payload.source_run_id),
    sourceKind: "codex_agent"
  });
  const taskCandidateCount = await repository.upsertTaskCandidates({
    userId: user.id,
    snapshotId: snapshot.id,
    items: snapshot.structuredBrief?.taskCandidates ?? []
  });

  return jsonResponse(
    {
      ok: true,
      snapshotId: snapshot.id,
      slot: snapshot.slot,
      generatedAt: snapshot.generatedAt,
      taskCandidateCount,
      taskPersistence: "candidate_only",
      excludedColumns: [...sanitizedJsonBundle.excludedColumns, ...sanitizedStructuredBrief.excludedColumns].sort()
    },
    { status: 201 }
  );
}
