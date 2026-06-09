import { D1_TABLES } from "@/db/schema";
import type {
  ExecutiveBriefSlotLabel,
  JsonValue,
  StructuredExecutiveBrief,
  StructuredExecutiveBriefItem
} from "@/lib/brief/executive-brief-snapshots";
import { assertD1Success, type D1Database } from "@/lib/d1/types";
import { encodeD1Json, encodeD1JsonArray } from "@/lib/d1/json";

export type D1ExecutiveBriefSnapshotInput = {
  id?: string;
  userId: string;
  subject: string;
  slot: ExecutiveBriefSlotLabel;
  generatedAt: string | null;
  displayDate: string | null;
  humanBrief: string | null;
  jsonBundle: JsonValue | null;
  structuredBrief: StructuredExecutiveBrief | null;
  contractVersion: string | null;
  validationWarnings: string[];
  sourceMessageId: string | null;
  sourceRunId: string | null;
  sourceKind: "codex_agent" | "supabase_migration" | "cloudmailin_fallback";
};

export type D1ExecutiveBriefSnapshotRecord = D1ExecutiveBriefSnapshotInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type D1TaskCandidateInput = {
  userId: string;
  snapshotId: string;
  item: StructuredExecutiveBriefItem;
  dedupeKey: string;
};

export type ExecutiveBriefD1Repository = {
  ensureUser(input: { userId: string; email: string; displayName?: string | null }): Promise<void>;
  upsertSnapshot(input: D1ExecutiveBriefSnapshotInput): Promise<D1ExecutiveBriefSnapshotRecord>;
  upsertTaskCandidates(input: { userId: string; snapshotId: string; items: StructuredExecutiveBriefItem[] }): Promise<number>;
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function taskCandidateDedupeKey(input: D1TaskCandidateInput) {
  const itemKey = compactText(input.item.id) || compactText(input.item.title).toLowerCase();
  const dueKey = compactText(input.item.dueAt) || "no_due";
  return input.dedupeKey || `executive_brief:${input.userId}:${input.snapshotId}:${itemKey}:${dueKey}`;
}

export function createExecutiveBriefD1Repository(db: D1Database): ExecutiveBriefD1Repository {
  return {
    async ensureUser(input) {
      const timestamp = nowIso();
      const result = await db
        .prepare(
          `INSERT INTO ${D1_TABLES.users} (id, email, display_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(email) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`
        )
        .bind(input.userId, input.email, input.displayName ?? null, timestamp, timestamp)
        .run();
      assertD1Success(result, "D1 user upsert");
    },

    async upsertSnapshot(input) {
      const snapshotId = input.id ?? makeId("brief");
      const timestamp = nowIso();
      const result = await db
        .prepare(
          `INSERT INTO ${D1_TABLES.executiveBriefSnapshots} (
             id, user_id, subject, slot, generated_at, display_date, human_brief,
             json_bundle, structured_brief, contract_version, validation_warnings,
             source_message_id, source_run_id, source_kind, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, source_message_id) WHERE source_message_id IS NOT NULL
           DO UPDATE SET
             subject = excluded.subject,
             slot = excluded.slot,
             generated_at = excluded.generated_at,
             display_date = excluded.display_date,
             human_brief = excluded.human_brief,
             json_bundle = excluded.json_bundle,
             structured_brief = excluded.structured_brief,
             contract_version = excluded.contract_version,
             validation_warnings = excluded.validation_warnings,
             source_run_id = excluded.source_run_id,
             source_kind = excluded.source_kind,
             updated_at = excluded.updated_at`
        )
        .bind(
          snapshotId,
          input.userId,
          input.subject,
          input.slot,
          input.generatedAt,
          input.displayDate,
          input.humanBrief,
          encodeD1Json(input.jsonBundle),
          encodeD1Json(input.structuredBrief as JsonValue | null),
          input.contractVersion,
          encodeD1JsonArray(input.validationWarnings),
          input.sourceMessageId,
          input.sourceRunId,
          input.sourceKind,
          timestamp,
          timestamp
        )
        .run();

      assertD1Success(result, "D1 Executive Brief snapshot upsert");

      return {
        ...input,
        id: snapshotId,
        createdAt: timestamp,
        updatedAt: timestamp
      };
    },

    async upsertTaskCandidates(input) {
      let upsertedCount = 0;
      const timestamp = nowIso();

      for (const item of input.items) {
        const candidateInput: D1TaskCandidateInput = {
          userId: input.userId,
          snapshotId: input.snapshotId,
          item,
          dedupeKey: ""
        };
        const dedupeKey = taskCandidateDedupeKey(candidateInput);
        const result = await db
          .prepare(
            `INSERT INTO ${D1_TABLES.executiveBriefTaskCandidates} (
               id, user_id, snapshot_id, dedupe_key, title, summary, priority,
               recommended_action, due_at, source_refs, source_lane, status,
               created_at, updated_at
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?, ?)
             ON CONFLICT(user_id, dedupe_key) DO UPDATE SET
               title = excluded.title,
               summary = excluded.summary,
               priority = excluded.priority,
               recommended_action = excluded.recommended_action,
               due_at = excluded.due_at,
               source_refs = excluded.source_refs,
               source_lane = excluded.source_lane,
               updated_at = excluded.updated_at`
          )
          .bind(
            makeId("task_candidate"),
            input.userId,
            input.snapshotId,
            dedupeKey,
            item.title,
            item.summary,
            item.priority,
            item.recommendedAction,
            item.dueAt,
            encodeD1JsonArray(item.sourceRefs ?? []),
            item.sourceLane ?? null,
            timestamp,
            timestamp
          )
          .run();
        assertD1Success(result, "D1 Executive Brief task candidate upsert");
        upsertedCount += 1;
      }

      return upsertedCount;
    }
  };
}
