import {
  D1_STRUCTURED_ONLY_EXCLUDED_COLUMNS,
  D1_TABLES
} from "@/db/schema";
import type {
  ExecutiveBriefSlotLabel,
  JsonRecord,
  JsonValue,
  StructuredExecutiveBrief
} from "@/lib/brief/executive-brief-snapshots";

const EXTRA_EXCLUDED_KEYS = [
  "raw_body",
  "raw_text",
  "raw_html",
  "message_body",
  "email_body",
  "html_body",
  "text_body",
  "body_content",
  "body_preview",
  "body",
  "content",
  "html",
  "text",
  "description",
  "message",
  "message_body",
  "message_text",
  "message_html",
  "html_content",
  "text_content",
  "full_text",
  "full_html",
  "transcript",
  "transcript_text",
  "full_transcript",
  "calendar_description",
  "teams_message",
  "teams_message_body",
  "outlook_message_body",
  "graph_payload",
  "cloudmailin_payload",
  "headers",
  "authorization",
  "cookie",
  "token",
  "token_ciphertext"
] as const;

const EXCLUDED_KEY_SET = new Set<string>([
  ...D1_STRUCTURED_ONLY_EXCLUDED_COLUMNS,
  ...EXTRA_EXCLUDED_KEYS
].map((key) => key.toLowerCase()));

export type StructuredOnlySanitizeResult<T extends JsonValue | null> = {
  value: T;
  excludedColumns: string[];
};

export type SupabaseExecutiveBriefSnapshotExportRow = {
  id: string;
  user_id: string;
  subject: string;
  slot: ExecutiveBriefSlotLabel;
  generated_at: string | null;
  display_date: string | null;
  human_brief: string | null;
  json_bundle: JsonValue | null;
  structured_brief: JsonValue | null;
  contract_version: string | null;
  validation_warnings: string[] | null;
  source_message_id: string | null;
  created_at: string;
  updated_at?: string | null;
  [key: string]: unknown;
};

export type D1ExecutiveBriefSnapshotExportRow = {
  id: string;
  user_id: string;
  subject: string;
  slot: ExecutiveBriefSlotLabel;
  generated_at: string | null;
  display_date: string | null;
  human_brief: string | null;
  json_bundle: JsonValue | null;
  structured_brief: JsonValue | null;
  contract_version: string | null;
  validation_warnings: JsonValue[];
  source_message_id: string | null;
  source_run_id: string | null;
  source_kind: "supabase_migration";
  created_at: string;
  updated_at: string;
};

export type D1MigrationTransformResult<T> = {
  targetTable: (typeof D1_TABLES)[keyof typeof D1_TABLES];
  row: T;
  excludedColumns: string[];
};

function normalizeKey(key: string) {
  return key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).toLowerCase();
}

function shouldExcludeKey(key: string) {
  const normalized = normalizeKey(key);
  return EXCLUDED_KEY_SET.has(normalized);
}

function sanitizeUnknown(value: unknown, excludedColumns: Set<string>, path: string): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => sanitizeUnknown(entry, excludedColumns, `${path}[${index}]`))
      .filter((entry): entry is JsonValue => entry !== undefined);
  }

  if (value && typeof value === "object") {
    const output: JsonRecord = {};
    for (const [key, childValue] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;
      if (shouldExcludeKey(key)) {
        excludedColumns.add(childPath);
        continue;
      }

      const sanitized = sanitizeUnknown(childValue, excludedColumns, childPath);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }

    return output;
  }

  return undefined;
}

export function sanitizeStructuredOnlyJson<T extends JsonValue | null>(value: T): StructuredOnlySanitizeResult<T> {
  const excludedColumns = new Set<string>();
  const sanitized = sanitizeUnknown(value, excludedColumns, "") ?? null;
  return {
    value: sanitized as T,
    excludedColumns: [...excludedColumns].sort()
  };
}

function sanitizeWarnings(value: string[] | null | undefined): JsonValue[] {
  return (value ?? []).filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
}

export function transformExecutiveBriefSnapshotForD1(
  row: SupabaseExecutiveBriefSnapshotExportRow
): D1MigrationTransformResult<D1ExecutiveBriefSnapshotExportRow> {
  const sanitizedJsonBundle = sanitizeStructuredOnlyJson(row.json_bundle);
  const sanitizedStructuredBrief = sanitizeStructuredOnlyJson(row.structured_brief);
  const excludedColumns = new Set<string>([
    ...sanitizedJsonBundle.excludedColumns.map((entry) => `json_bundle.${entry}`),
    ...sanitizedStructuredBrief.excludedColumns.map((entry) => `structured_brief.${entry}`)
  ]);

  for (const key of Object.keys(row)) {
    if (shouldExcludeKey(key)) {
      excludedColumns.add(key);
    }
  }

  return {
    targetTable: D1_TABLES.executiveBriefSnapshots,
    row: {
      id: row.id,
      user_id: row.user_id,
      subject: row.subject,
      slot: row.slot,
      generated_at: row.generated_at,
      display_date: row.display_date,
      human_brief: row.human_brief,
      json_bundle: sanitizedJsonBundle.value,
      structured_brief: sanitizedStructuredBrief.value as StructuredExecutiveBrief | null,
      contract_version: row.contract_version,
      validation_warnings: sanitizeWarnings(row.validation_warnings),
      source_message_id: row.source_message_id,
      source_run_id: null,
      source_kind: "supabase_migration",
      created_at: row.created_at,
      updated_at: row.updated_at ?? row.created_at
    },
    excludedColumns: [...excludedColumns].sort()
  };
}
