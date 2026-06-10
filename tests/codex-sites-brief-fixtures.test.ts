import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

const DISALLOWED_KEYS = new Set([
  "raw_email_body",
  "raw_email_html",
  "raw_graph_payload",
  "protected_context",
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "message_text",
  "calendar_description",
  "transcript"
]);

function readFixture(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function jsonRecord(value: JsonValue | undefined): JsonRecord {
  assert.equal(Boolean(value && typeof value === "object" && !Array.isArray(value)), true);
  return value as JsonRecord;
}

function jsonArray(value: JsonValue | undefined): JsonValue[] {
  assert.equal(Array.isArray(value), true);
  return value as JsonValue[];
}

function assertNoDisallowedKeys(value: JsonValue, path = "fixture") {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoDisallowedKeys(entry, `${path}[${index}]`));
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    assert.equal(DISALLOWED_KEYS.has(key), false, `${path}.${key} must not appear in valid Codex Sites payloads`);
    assertNoDisallowedKeys(childValue, `${path}.${key}`);
  }
}

test("valid Codex Sites Executive Brief fixture includes required structured sections and no raw fields", () => {
  const fixture = readFixture("fixtures/codex-sites-executive-brief-valid-payload.json");
  const bundle = jsonRecord(fixture.json_bundle);

  assert.equal(fixture.slot, "11 AM");
  assert.equal(bundle.contract_version, "executive_brief.v1");
  assert.equal(jsonArray(bundle.source_coverage).length, 3);
  assert.ok(jsonArray(bundle.command_summary).length > 0);
  assert.ok(jsonArray(bundle.top_3_executive_moves).length > 0);
  assert.ok(jsonArray(bundle.decisions_needed).length > 0);
  assert.ok(jsonArray(bundle.meeting_prep).length > 0);
  assert.ok(jsonArray(bundle.carry_forward).length > 0);
  assert.ok(jsonArray(bundle.task_candidates).length > 0);

  for (const section of ["top_3_executive_moves", "decisions_needed", "meeting_prep", "carry_forward", "task_candidates"]) {
    const firstItem = jsonRecord(jsonArray(bundle[section])[0]);
    assert.ok(jsonArray(firstItem.source_refs).length > 0, `${section} must include source refs`);
  }

  assertNoDisallowedKeys(fixture);
});
