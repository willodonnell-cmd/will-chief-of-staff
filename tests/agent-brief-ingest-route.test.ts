import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { handleAgentBriefIngestRequest } from "../lib/sites/agent-brief-ingest-route";
import type {
  D1ExecutiveBriefSnapshotInput,
  D1ExecutiveBriefSnapshotRecord,
  ExecutiveBriefD1Repository
} from "../lib/d1/executive-brief-repository";
import type { StructuredExecutiveBriefItem } from "../lib/brief/executive-brief-snapshots";

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
      id: "brief-test-1",
      createdAt: "2026-06-09T14:00:00.000Z",
      updatedAt: "2026-06-09T14:00:00.000Z"
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

test("agent brief ingest stores structured snapshots and candidate-only tasks", async () => {
  const repository = new FakeExecutiveBriefRepository();
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousWorkspaceIngest = process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST;
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST = "true";

  try {
    const request = new Request("http://localhost/api/brief/agent-ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "oai-authenticated-user-email": "will@example.com",
        "oai-authenticated-user-full-name": "Will%20O%27Donnell",
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8"
      },
      body: JSON.stringify({
        slot: "7 AM",
        generated_at: "2026-06-09T14:00:00.000Z",
        json_bundle: {
          contract_version: "executive_brief.v1",
          command_summary: ["Focus on the lender memo."],
          task_candidates: [
            {
              id: "task-1",
              title: "Ask Maya for lender update",
              priority: "high",
              raw_email_body: "do not persist"
            }
          ]
        },
        source_run_id: "codex-run-1"
      })
    });

    const response = await handleAgentBriefIngestRequest(request, { repository });
    const body = (await response.json()) as {
      ok: boolean;
      snapshotId: string;
      taskCandidateCount: number;
      taskPersistence: string;
      excludedColumns: string[];
    };

    assert.equal(response.status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.snapshotId, "brief-test-1");
    assert.equal(body.taskCandidateCount, 1);
    assert.equal(body.taskPersistence, "candidate_only");
    assert.deepEqual(body.excludedColumns, ["task_candidates[0].raw_email_body"]);
    assert.equal(repository.users[0]?.email, "will@example.com");
    assert.equal(repository.users[0]?.displayName, "Will O'Donnell");
    assert.equal(repository.snapshots[0]?.slot, "7 AM");
    assert.equal(repository.snapshots[0]?.sourceKind, "codex_agent");
    assert.equal(repository.taskCandidates[0]?.title, "Ask Maya for lender update");
  } finally {
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousWorkspaceIngest === undefined) {
      delete process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST;
    } else {
      process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST = previousWorkspaceIngest;
    }
  }
});

test("agent brief ingest strips unsafe fields from fixture payload before storage", async () => {
  const repository = new FakeExecutiveBriefRepository();
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousSecret = process.env.BLACKHAWK_AGENT_INGEST_SECRET;
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_AGENT_INGEST_SECRET = "proof-secret";

  try {
    const request = new Request("http://localhost/api/brief/agent-ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-blackhawk-agent-ingest-secret": "proof-secret"
      },
      body: readFileSync("fixtures/codex-sites-executive-brief-payload.json", "utf8")
    });

    const response = await handleAgentBriefIngestRequest(request, { repository });
    const body = (await response.json()) as { excludedColumns: string[] };
    const storedSnapshot = JSON.stringify(repository.snapshots[0]);

    assert.equal(response.status, 201);
    assert.deepEqual(body.excludedColumns, [
      "decisions_needed[0].calendar_description",
      "protected_context",
      "taskCandidates[0].sourceRefs[0].message_text",
      "task_candidates[0].source_refs[0].message_text",
      "topMoves[0].sourceRefs[0].body",
      "top_3_executive_moves[0].raw_email_body",
      "top_3_executive_moves[0].source_refs[0].body"
    ]);
    assert.doesNotMatch(storedSnapshot, /raw message body/i);
    assert.doesNotMatch(storedSnapshot, /raw email body/i);
    assert.doesNotMatch(storedSnapshot, /raw Teams message/i);
    assert.doesNotMatch(storedSnapshot, /protected context/i);
    assert.equal(repository.taskCandidates[0]?.title, "Ask Maya for lender update");
  } finally {
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousSecret === undefined) {
      delete process.env.BLACKHAWK_AGENT_INGEST_SECRET;
    } else {
      process.env.BLACKHAWK_AGENT_INGEST_SECRET = previousSecret;
    }
  }
});

test("agent brief ingest rejects malformed JSON", async () => {
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousSecret = process.env.BLACKHAWK_AGENT_INGEST_SECRET;
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_AGENT_INGEST_SECRET = "proof-secret";

  try {
    const response = await handleAgentBriefIngestRequest(
      new Request("http://localhost/api/brief/agent-ingest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-blackhawk-agent-ingest-secret": "proof-secret"
        },
        body: "{not json"
      }),
      { repository: new FakeExecutiveBriefRepository() }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_json" });
  } finally {
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousSecret === undefined) {
      delete process.env.BLACKHAWK_AGENT_INGEST_SECRET;
    } else {
      process.env.BLACKHAWK_AGENT_INGEST_SECRET = previousSecret;
    }
  }
});

test("agent brief ingest rejects oversized payloads before persistence", async () => {
  const repository = new FakeExecutiveBriefRepository();
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousSecret = process.env.BLACKHAWK_AGENT_INGEST_SECRET;
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_AGENT_INGEST_SECRET = "proof-secret";

  try {
    const response = await handleAgentBriefIngestRequest(
      new Request("http://localhost/api/brief/agent-ingest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "500",
          "x-blackhawk-agent-ingest-secret": "proof-secret"
        },
        body: JSON.stringify({ json_bundle: { task_candidates: [{ title: "Too large" }] } })
      }),
      { repository, maxRequestBytes: 100 }
    );

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "payload_too_large" });
    assert.equal(repository.snapshots.length, 0);
  } finally {
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousSecret === undefined) {
      delete process.env.BLACKHAWK_AGENT_INGEST_SECRET;
    } else {
      process.env.BLACKHAWK_AGENT_INGEST_SECRET = previousSecret;
    }
  }
});

test("agent brief ingest reports a clear error when D1 is unavailable", async () => {
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousSecret = process.env.BLACKHAWK_AGENT_INGEST_SECRET;
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_AGENT_INGEST_SECRET = "proof-secret";

  try {
    const response = await handleAgentBriefIngestRequest(
      new Request("http://localhost/api/brief/agent-ingest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-blackhawk-agent-ingest-secret": "proof-secret"
        },
        body: JSON.stringify({
          json_bundle: {
            contract_version: "executive_brief.v1",
            command_summary: ["Confirm Sites D1 binding."]
          }
        })
      })
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "d1_binding_unavailable",
      message: "D1 binding DB is unavailable; configure the Codex Sites D1 binding before running the proof workflow."
    });
  } finally {
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousSecret === undefined) {
      delete process.env.BLACKHAWK_AGENT_INGEST_SECRET;
    } else {
      process.env.BLACKHAWK_AGENT_INGEST_SECRET = previousSecret;
    }
  }
});

test("agent brief ingest rejects mismatched workspace users", async () => {
  const previousPrimaryEmail = process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
  const previousWorkspaceIngest = process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST;
  process.env.BLACKHAWK_PRIMARY_USER_EMAIL = "will@example.com";
  process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST = "true";

  try {
    const response = await handleAgentBriefIngestRequest(
      new Request("http://localhost/api/brief/agent-ingest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "someone-else@example.com"
        },
        body: JSON.stringify({ json_bundle: { task_candidates: [{ title: "Do not persist" }] } })
      }),
      { repository: new FakeExecutiveBriefRepository() }
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  } finally {
    if (previousPrimaryEmail === undefined) {
      delete process.env.BLACKHAWK_PRIMARY_USER_EMAIL;
    } else {
      process.env.BLACKHAWK_PRIMARY_USER_EMAIL = previousPrimaryEmail;
    }
    if (previousWorkspaceIngest === undefined) {
      delete process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST;
    } else {
      process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST = previousWorkspaceIngest;
    }
  }
});
