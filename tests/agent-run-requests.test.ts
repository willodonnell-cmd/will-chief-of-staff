import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentRunRequestConflictError,
  claimAgentRunRequest,
  createManualAgentRunRequest,
  getAgentRunRequestButtonState,
  getLatestAgentRunRequest,
  type AgentRunRequestRow,
  type AgentRunRequestsRepository
} from "../lib/agent-run-requests";
import {
  handleClaimAgentRunRequest,
  handleCompleteAgentRunRequest,
  handleCreateAgentRunRequest,
  handleFailAgentRunRequest,
  handleGetLatestAgentRunRequest,
  handleGetPendingAgentRunRequests
} from "../lib/agent-run-requests-route";

function createMemoryRepository(seed: AgentRunRequestRow[] = []) {
  const rows = new Map(seed.map((row) => [row.id, { ...row }]));
  let nextId = seed.length + 1;

  const repository: AgentRunRequestsRepository = {
    async create(row) {
      const created: AgentRunRequestRow = {
        id: `request-${nextId++}`,
        created_at: row.requested_at,
        updated_at: row.requested_at,
        ...row
      };
      rows.set(created.id, created);
      return created;
    },
    async update(requestId, row) {
      const existing = rows.get(requestId);
      if (!existing) {
        return null;
      }

      const updated: AgentRunRequestRow = {
        ...existing,
        ...row,
        updated_at: (row.completed_at ?? row.claimed_at ?? existing.updated_at) as string
      };
      rows.set(requestId, updated);
      return updated;
    },
    async findById(requestId) {
      return rows.get(requestId) ?? null;
    },
    async findLatestByUser(userId) {
      return [...rows.values()]
        .filter((row) => row.user_id === userId)
        .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0] ?? null;
    },
    async findActiveByUser(userId, now) {
      return [...rows.values()]
        .filter(
          (row) =>
            row.user_id === userId &&
            (row.status === "requested" || row.status === "claimed") &&
            Date.parse(row.expires_at) > Date.parse(now)
        )
        .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0] ?? null;
    },
    async listPending(now) {
      return [...rows.values()]
        .filter((row) => row.status === "requested" && Date.parse(row.expires_at) > Date.parse(now))
        .sort((a, b) => Date.parse(a.requested_at) - Date.parse(b.requested_at));
    },
    async expire(now, userId) {
      let count = 0;
      for (const row of rows.values()) {
        if (userId && row.user_id !== userId) {
          continue;
        }

        if ((row.status === "requested" || row.status === "claimed") && Date.parse(row.expires_at) < Date.parse(now)) {
          row.status = "expired";
          row.completed_at = now;
          row.updated_at = now;
          count += 1;
        }
      }
      return count;
    }
  };

  return {
    repository,
    rows
  };
}

function createRequestRow(overrides: Partial<AgentRunRequestRow> = {}): AgentRunRequestRow {
  return {
    id: "request-1",
    user_id: "user-1",
    request_type: "manual",
    status: "requested",
    requested_at: "2026-06-04T16:00:00Z",
    claimed_at: null,
    completed_at: null,
    expires_at: "2099-06-04T16:30:00Z",
    agent_signal_run_id: null,
    requested_by: "Will O'Donnell",
    request_context: {
      requestedFrom: "blackhawk_ui"
    },
    error_message: null,
    created_at: "2026-06-04T16:00:00Z",
    updated_at: "2026-06-04T16:00:00Z",
    ...overrides
  };
}

function createResolvedUser() {
  return {
    client: {} as never,
    user: {
      id: "user-1",
      auth_user_id: null,
      email: "local@chief-of-staff.app",
      full_name: "Will O'Donnell",
      timezone: "America/Los_Angeles"
    },
    source: "bootstrap" as const,
    authUser: null
  };
}

function jsonBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

test("creating a manual run request returns a requested durable request", async () => {
  const memory = createMemoryRepository();

  const request = await createManualAgentRunRequest(memory.repository, {
    userId: "user-1",
    requestedBy: "Will O'Donnell",
    requestContext: {
      requestedFrom: "blackhawk_ui"
    },
    now: "2026-06-04T16:00:00Z"
  });

  assert.equal(request.status, "requested");
  assert.equal(request.isActive, true);
  assert.equal(memory.rows.size, 1);
});

test("latest request endpoint returns the latest manual request for the current user", async () => {
  const memory = createMemoryRepository([
    createRequestRow({
      id: "request-1",
      requested_at: "2026-06-04T16:00:00Z"
    }),
    createRequestRow({
      id: "request-2",
      status: "completed",
      requested_at: "2026-06-04T17:00:00Z",
      completed_at: "2026-06-04T17:02:00Z",
      agent_signal_run_id: "run-9"
    })
  ]);

  const response = await handleGetLatestAgentRunRequest(new Request("http://localhost"), {
    resolveAppUser: async () => createResolvedUser(),
    createUserRepository: async () => memory.repository
  });

  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal((body.request as { id: string }).id, "request-2");
});

test("pending request endpoint requires a secret", async () => {
  const response = await handleGetPendingAgentRunRequests(new Request("http://localhost"), {
    env: {
      ...process.env,
      AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
    },
    createAdminRepository: async () => createMemoryRepository().repository
  });

  assert.equal(response.status, 401);
});

test("claim endpoint requires secret and transitions requested to claimed", async () => {
  const memory = createMemoryRepository([createRequestRow()]);

  const unauthorized = await handleClaimAgentRunRequest(
    new Request("http://localhost", {
      method: "POST"
    }),
    "request-1",
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      createAdminRepository: async () => memory.repository
    }
  );

  assert.equal(unauthorized.status, 401);

  const authorized = await handleClaimAgentRunRequest(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "x-agent-signals-import-secret": "top-secret"
      }
    }),
    "request-1",
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      now: () => "2026-06-04T16:05:00Z",
      createAdminRepository: async () => memory.repository
    }
  );

  assert.equal(authorized.status, 200);
  const body = await jsonBody(authorized);
  assert.equal((body.request as { status: string }).status, "claimed");
});

test("complete endpoint attaches agent_signal_run_id and transitions to completed", async () => {
  const memory = createMemoryRepository([
    createRequestRow({
      status: "claimed",
      claimed_at: "2026-06-04T16:05:00Z"
    })
  ]);

  const response = await handleCompleteAgentRunRequest(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "x-agent-signals-import-secret": "top-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        agentSignalRunId: "run-11"
      })
    }),
    "request-1",
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      now: () => "2026-06-04T16:07:00Z",
      createAdminRepository: async () => memory.repository
    }
  );

  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal((body.request as { status: string }).status, "completed");
  assert.equal((body.request as { agentSignalRunId: string }).agentSignalRunId, "run-11");
});

test("failed endpoint records a safe error message", async () => {
  const memory = createMemoryRepository([createRequestRow()]);

  const response = await handleFailAgentRunRequest(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "x-agent-signals-import-secret": "top-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        errorMessage: "  Agent heartbeat missed the window and did not complete the run.  "
      })
    }),
    "request-1",
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      now: () => "2026-06-04T16:08:00Z",
      createAdminRepository: async () => memory.repository
    }
  );

  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal((body.request as { status: string }).status, "failed");
  assert.equal(
    (body.request as { errorMessage: string }).errorMessage,
    "Agent heartbeat missed the window and did not complete the run."
  );
});

test("expired requests do not block a new manual request", async () => {
  const memory = createMemoryRepository([
    createRequestRow({
      expires_at: "2026-06-04T15:00:00Z"
    })
  ]);

  const created = await createManualAgentRunRequest(memory.repository, {
    userId: "user-1",
    requestedBy: "Will O'Donnell",
    now: "2026-06-04T16:00:00Z"
  });

  assert.equal(created.id, "request-2");
  assert.equal(created.status, "requested");
  assert.equal(memory.rows.get("request-1")?.status, "expired");
});

test("pending request endpoint lists unexpired manual requests for the agent", async () => {
  const memory = createMemoryRepository([
    createRequestRow(),
    createRequestRow({
      id: "request-2",
      user_id: "user-2",
      requested_at: "2026-06-04T16:01:00Z"
    })
  ]);

  const response = await handleGetPendingAgentRunRequests(
    new Request("http://localhost", {
      headers: {
        "x-agent-signals-import-secret": "top-secret"
      }
    }),
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      createAdminRepository: async () => memory.repository
    }
  );

  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal((body.requests as Array<{ id: string }>).length, 2);
});

test("UI disables the button while a manual request is active", async () => {
  const activeState = getAgentRunRequestButtonState(
    await getLatestAgentRunRequest(createMemoryRepository([createRequestRow()]).repository, {
      userId: "user-1",
      now: "2026-06-04T16:00:00Z"
    })
  );

  assert.equal(activeState.disabled, true);
  assert.equal(activeState.label, "Agent run requested");

  const inactiveState = getAgentRunRequestButtonState(
    await getLatestAgentRunRequest(
      createMemoryRepository([
        createRequestRow({
          status: "completed",
          completed_at: "2026-06-04T16:10:00Z",
          agent_signal_run_id: "run-4"
        })
      ]).repository,
      {
        userId: "user-1",
        now: "2026-06-04T16:12:00Z"
      }
    )
  );

  assert.equal(inactiveState.disabled, false);
  assert.equal(inactiveState.label, "Run Agent Now");
});

test("UI marks manual runs unavailable when the schema is missing", () => {
  const unavailableState = getAgentRunRequestButtonState(null, {
    available: false
  });

  assert.equal(unavailableState.disabled, true);
  assert.equal(unavailableState.label, "Agent run unavailable");
});

test("create route returns the created manual request summary", async () => {
  const memory = createMemoryRepository();

  const response = await handleCreateAgentRunRequest(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        requestedBy: "Will O'Donnell",
        requestContext: {
          requestedFrom: "blackhawk_ui"
        }
      })
    }),
    {
      now: () => "2026-06-04T16:00:00Z",
      resolveAppUser: async () => createResolvedUser(),
      createUserRepository: async () => memory.repository
    }
  );

  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.status, "requested");
  assert.equal(body.requestId, "request-1");
});

test("claiming a completed request throws a conflict", async () => {
  const memory = createMemoryRepository([
    createRequestRow({
      status: "completed",
      completed_at: "2026-06-04T16:06:00Z",
      agent_signal_run_id: "run-1"
    })
  ]);

  await assert.rejects(
    claimAgentRunRequest(memory.repository, {
      requestId: "request-1",
      now: "2026-06-04T16:08:00Z"
    }),
    AgentRunRequestConflictError
  );
});
