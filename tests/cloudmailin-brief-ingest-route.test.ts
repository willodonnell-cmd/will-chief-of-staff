import assert from "node:assert/strict";
import test from "node:test";

import type { StructuredExecutiveBriefItem } from "../lib/brief/executive-brief-snapshots";
import type {
  D1ExecutiveBriefSnapshotInput,
  D1ExecutiveBriefSnapshotRecord,
  ExecutiveBriefD1Repository
} from "../lib/d1/executive-brief-repository";
import type { D1Database, D1PreparedStatement, D1Result, D1Value } from "../lib/d1/types";
import { handleCloudMailinBriefIngestRequest } from "../lib/sites/cloudmailin-brief-ingest-route";
import publicBriefIngestWorker from "../workers/public-brief-ingest";

class FakeExecutiveBriefRepository implements ExecutiveBriefD1Repository {
  users: Array<{ userId: string; email: string; displayName?: string | null }> = [];
  snapshots: D1ExecutiveBriefSnapshotInput[] = [];
  taskCandidates: StructuredExecutiveBriefItem[] = [];

  async ensureUser(input: { userId: string; email: string; displayName?: string | null }) {
    this.users.push(input);
  }

  async upsertSnapshot(input: D1ExecutiveBriefSnapshotInput): Promise<D1ExecutiveBriefSnapshotRecord> {
    this.snapshots.push(input);
    return {
      ...input,
      id: "brief-cloudmailin-1",
      createdAt: "2026-07-04T12:00:00.000Z",
      updatedAt: "2026-07-04T12:00:00.000Z"
    };
  }

  async upsertTaskCandidates(input: {
    userId: string;
    snapshotId: string;
    items: StructuredExecutiveBriefItem[];
  }): Promise<number> {
    this.taskCandidates.push(...input.items);
    return input.items.length;
  }
}

type FakeLatestSnapshotRow = {
  id: string;
  slot: string;
  generated_at: string | null;
  created_at: string;
};

class FakeD1Statement implements D1PreparedStatement {
  constructor(
    readonly query: string,
    readonly latestSnapshot: FakeLatestSnapshotRow | null = null
  ) {}

  bind(...values: D1Value[]): D1PreparedStatement {
    void values;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    if (/FROM\s+executive_brief_snapshots/i.test(this.query)) {
      return this.latestSnapshot as T | null;
    }

    return null;
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    return { success: true, results: [] };
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    return { success: true, results: [] };
  }
}

class FakeD1Database implements D1Database {
  constructor(readonly latestSnapshot: FakeLatestSnapshotRow | null = null) {}

  prepare(query: string): D1PreparedStatement {
    return new FakeD1Statement(query, this.latestSnapshot);
  }
}

function buildCloudMailinPayload(plain: string, overrides: Record<string, unknown> = {}) {
  return {
    envelope: {
      to: "2ae55e8794c00d406710@cloudmailin.net",
      from: "chief-of-staff-agent@example.com"
    },
    headers: {
      subject: "BLACKHAWK_BRIEF_BUNDLE 7 AM",
      date: "Sat, 04 Jul 2026 09:00:00 -0700",
      "message-id": "<brief-live-1@example.com>",
      from: "Chief of Staff Agent <chief-of-staff-agent@example.com>"
    },
    plain,
    ...overrides
  };
}

function buildValidBriefEmailBody() {
  return [
    "Human brief:",
    "Focus on the lender memo before the next brief.",
    "",
    "BLACKHAWK_JSON_START",
    JSON.stringify({
      contract_version: "executive_brief.v1",
      slot: "7 AM",
      generated_at: "2026-07-04T16:00:00.000Z",
      command_summary: ["Lender memo is the main attention item."],
      top_3_executive_moves: [
        {
          id: "move-lender",
          title: "Send lender memo decision",
          summary: "Maya is waiting on Will before the lender packet moves.",
          source: "Outlook",
          priority: "high",
          recommended_action: "Approve or redirect the memo."
        }
      ],
      task_candidates: [
        {
          id: "task-lender",
          title: "Ask Maya for lender packet update",
          priority: "medium",
          raw_email_body: "do not persist"
        }
      ]
    }),
    "BLACKHAWK_JSON_END"
  ].join("\n");
}

test("CloudMailIn Executive Brief payload parses and writes to D1-compatible storage", async () => {
  const repository = new FakeExecutiveBriefRepository();
  const response = await handleCloudMailinBriefIngestRequest(
    new Request("https://worker.example/api/inbox/cloudmailin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCloudMailinPayload(buildValidBriefEmailBody()))
    }),
    {
      repository,
      env: {
        BLACKHAWK_PRIMARY_USER_ID: "will-primary",
        BLACKHAWK_PRIMARY_USER_EMAIL: "will@example.com"
      }
    }
  );
  const body = (await response.json()) as {
    ok: boolean;
    snapshotId: string;
    taskCandidateCount: number;
    taskPersistence: string;
    validationWarnings: string[];
  };

  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.snapshotId, "brief-cloudmailin-1");
  assert.equal(body.taskCandidateCount, 1);
  assert.equal(body.taskPersistence, "candidate_only");
  assert.deepEqual(body.validationWarnings, ["Excluded unsafe JSON bundle field: task_candidates[0].raw_email_body"]);
  assert.equal(repository.users[0]?.userId, "will-primary");
  assert.equal(repository.snapshots[0]?.sourceKind, "cloudmailin_fallback");
  assert.equal(repository.snapshots[0]?.sourceMessageId, "brief-live-1@example.com");
  assert.equal(repository.snapshots[0]?.slot, "7 AM");
  assert.equal(repository.snapshots[0]?.generatedAt, "2026-07-04T16:00:00.000Z");
  assert.equal(repository.taskCandidates[0]?.title, "Ask Maya for lender packet update");
  assert.doesNotMatch(JSON.stringify(repository.snapshots[0]), /do not persist/);
});

test("CloudMailIn Executive Brief payload without JSON fails with useful diagnostics", async () => {
  const repository = new FakeExecutiveBriefRepository();
  const response = await handleCloudMailinBriefIngestRequest(
    new Request("https://worker.example/api/inbox/cloudmailin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCloudMailinPayload("Human brief only. No structured JSON bundle was included."))
    }),
    {
      repository,
      env: {
        BLACKHAWK_PRIMARY_USER_EMAIL: "will@example.com"
      }
    }
  );
  const body = (await response.json()) as { error: string; validationWarnings: string[] };

  assert.equal(response.status, 422);
  assert.equal(body.error, "structured_brief_required");
  assert.deepEqual(body.validationWarnings, ["No JSON object bundle was found."]);
  assert.equal(repository.snapshots.length, 0);
});

test("CloudMailIn Executive Brief payload with invalid JSON fails with useful diagnostics", async () => {
  const repository = new FakeExecutiveBriefRepository();
  const response = await handleCloudMailinBriefIngestRequest(
    new Request("https://worker.example/api/inbox/cloudmailin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCloudMailinPayload(["Human brief first.", "```json", "{\"slot\":", "```"].join("\n")))
    }),
    {
      repository,
      env: {
        BLACKHAWK_PRIMARY_USER_EMAIL: "will@example.com"
      }
    }
  );
  const body = (await response.json()) as { error: string; validationWarnings: string[] };

  assert.equal(response.status, 422);
  assert.equal(body.error, "structured_brief_required");
  assert.deepEqual(body.validationWarnings, ["No JSON object bundle was found."]);
  assert.equal(repository.snapshots.length, 0);
});

test("public Worker direct Executive Brief JSON ingest route still works", async () => {
  const response = await publicBriefIngestWorker.fetch(
    new Request("https://worker.example/api/brief/agent-ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-blackhawk-brief-ingest-secret": "proof-secret"
      },
      body: JSON.stringify({
        slot: "Manual",
        generated_at: "2026-07-04T16:30:00.000Z",
        json_bundle: {
          contract_version: "executive_brief.v1",
          command_summary: ["Direct Worker route still writes D1."],
          task_candidates: [{ id: "task-worker", title: "Confirm direct worker route", priority: "medium" }]
        }
      })
    }),
    {
      DB: new FakeD1Database(),
      BLACKHAWK_BRIEF_INGEST_SECRET: "proof-secret",
      BLACKHAWK_PRIMARY_USER_ID: "will-primary",
      BLACKHAWK_PRIMARY_USER_EMAIL: "will@example.com"
    } as unknown as Parameters<typeof publicBriefIngestWorker.fetch>[1]
  );
  const body = (await response.json()) as { ok: boolean; taskPersistence: string };

  assert.equal(response.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.taskPersistence, "candidate_only");
});

test("public Worker health endpoint reads the latest D1 snapshot", async () => {
  const response = await publicBriefIngestWorker.fetch(
    new Request("https://worker.example/health", {
      method: "GET"
    }),
    {
      DB: new FakeD1Database({
        id: "brief-health-1",
        slot: "7 AM",
        generated_at: "2026-07-04T16:00:00.000Z",
        created_at: "2026-07-04T16:05:00.000Z"
      }),
      BLACKHAWK_PRIMARY_USER_EMAIL: "will@example.com"
    } as unknown as Parameters<typeof publicBriefIngestWorker.fetch>[1]
  );
  const body = (await response.json()) as {
    d1BindingAvailable: boolean;
    latestSnapshot: {
      id: string;
      slot: string;
      generatedAt: string | null;
      createdAt: string;
    } | null;
  };

  assert.equal(response.status, 200);
  assert.equal(body.d1BindingAvailable, true);
  assert.deepEqual(body.latestSnapshot, {
    id: "brief-health-1",
    slot: "7 AM",
    generatedAt: "2026-07-04T16:00:00.000Z",
    createdAt: "2026-07-04T16:05:00.000Z"
  });
});
