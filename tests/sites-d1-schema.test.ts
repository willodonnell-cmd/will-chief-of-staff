import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  D1_BINDING_NAME,
  D1_EXECUTIVE_BRIEF_SLOT_LABELS,
  D1_STRUCTURED_ONLY_EXCLUDED_COLUMNS,
  D1_TABLES
} from "../db/schema";
import { EXECUTIVE_BRIEF_SLOT_LABELS } from "../lib/brief/executive-brief-snapshots";

test("Sites hosting metadata declares the D1 binding without provisioning a second project id", () => {
  const hosting = JSON.parse(readFileSync(".openai/hosting.json", "utf8")) as {
    project_id?: string;
    d1?: string;
    r2?: string | null;
  };

  assert.equal(hosting.project_id, undefined);
  assert.equal(hosting.d1, D1_BINDING_NAME);
  assert.equal(hosting.r2, null);
});

test("D1 schema keeps the current Executive Brief slot contract", () => {
  assert.deepEqual(D1_EXECUTIVE_BRIEF_SLOT_LABELS, EXECUTIVE_BRIEF_SLOT_LABELS);

  const migrationSql = readFileSync("drizzle/0001_sites_d1_initial.sql", "utf8");
  for (const slot of EXECUTIVE_BRIEF_SLOT_LABELS) {
    assert.match(migrationSql, new RegExp(`'${slot}'`));
  }

  assert.match(migrationSql, new RegExp(`CREATE TABLE IF NOT EXISTS ${D1_TABLES.executiveBriefSnapshots}`));
  assert.match(migrationSql, new RegExp(`CREATE TABLE IF NOT EXISTS ${D1_TABLES.executiveBriefTaskCandidates}`));
  assert.match(migrationSql, /status TEXT NOT NULL DEFAULT 'candidate'/);
});

test("D1 migration schema does not introduce excluded raw or protected columns", () => {
  const migrationSql = readFileSync("drizzle/0001_sites_d1_initial.sql", "utf8").toLowerCase();

  for (const excludedColumn of D1_STRUCTURED_ONLY_EXCLUDED_COLUMNS) {
    assert.equal(
      migrationSql.includes(`${excludedColumn.toLowerCase()} `),
      false,
      `${excludedColumn} should stay out of the D1 structured schema`
    );
  }
});
