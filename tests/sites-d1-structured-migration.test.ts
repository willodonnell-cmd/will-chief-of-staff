import assert from "node:assert/strict";
import test from "node:test";

import { D1_TABLES } from "../db/schema";
import {
  sanitizeStructuredOnlyJson,
  transformExecutiveBriefSnapshotForD1,
  type SupabaseExecutiveBriefSnapshotExportRow
} from "../lib/d1/structured-migration";

test("structured-only sanitizer removes raw/protected fields recursively", () => {
  const result = sanitizeStructuredOnlyJson({
    title: "Board memo",
    source_refs: [{ sourceType: "outlook", id: "message-1" }],
    raw_email_body: "do not migrate",
    nested: {
      protected_context: "do not migrate",
      body: "do not migrate",
      calendar_description: "do not migrate",
      useful_summary: "preserve this"
    },
    items: [{ title: "Reply", raw_graph_payload: { body: "do not migrate" } }]
  });

  assert.deepEqual(result.value, {
    title: "Board memo",
    source_refs: [{ sourceType: "outlook", id: "message-1" }],
    nested: {
      useful_summary: "preserve this"
    },
    items: [{ title: "Reply" }]
  });
  assert.deepEqual(result.excludedColumns, [
    "items[0].raw_graph_payload",
    "nested.body",
    "nested.calendar_description",
    "nested.protected_context",
    "raw_email_body"
  ]);
});

test("Executive Brief migration transform preserves structured fields and drops raw history", () => {
  const row: SupabaseExecutiveBriefSnapshotExportRow = {
    id: "snapshot-1",
    user_id: "user-1",
    subject: "BLACKHAWK_BRIEF_BUNDLE 7 AM",
    slot: "7 AM",
    generated_at: "2026-06-09T14:00:00.000Z",
    display_date: "Tuesday, Jun 9",
    human_brief: "Three decisions need attention.",
    json_bundle: {
      contract_version: "executive_brief.v1",
      task_candidates: [{ title: "Ask Maya for lender update", raw_email_body: "do not migrate" }]
    },
    structured_brief: {
      taskCandidates: [{ title: "Ask Maya for lender update", sourceRefs: [{ id: "message-1" }] }],
      raw_payload: { message: "do not migrate" }
    },
    contract_version: "executive_brief.v1",
    validation_warnings: null,
    source_message_id: "message-1",
    raw_email_body: "raw email should be excluded",
    created_at: "2026-06-09T14:01:00.000Z"
  };

  const transformed = transformExecutiveBriefSnapshotForD1(row);

  assert.equal(transformed.targetTable, D1_TABLES.executiveBriefSnapshots);
  assert.equal(transformed.row.id, "snapshot-1");
  assert.equal(transformed.row.slot, "7 AM");
  assert.equal(transformed.row.source_kind, "supabase_migration");
  assert.deepEqual(transformed.row.validation_warnings, []);
  assert.deepEqual(transformed.row.json_bundle, {
    contract_version: "executive_brief.v1",
    task_candidates: [{ title: "Ask Maya for lender update" }]
  });
  assert.deepEqual(transformed.row.structured_brief, {
    taskCandidates: [{ title: "Ask Maya for lender update", sourceRefs: [{ id: "message-1" }] }]
  });
  assert.deepEqual(transformed.excludedColumns, [
    "json_bundle.task_candidates[0].raw_email_body",
    "raw_email_body",
    "structured_brief.raw_payload"
  ]);
});
