import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalPriorityInboxPageData,
  loadPriorityInboxPageDataWithDeps
} from "../lib/agent-signals/load-priority-inbox-page-data";
import type { AgentRunRequestRow } from "../lib/agent-run-requests";
import type { AgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";
import type { PriorityInboxRow } from "../lib/priority-inbox-store";

type PriorityInboxRowWithAgentRun = PriorityInboxRow & {
  agent_run_id: string | null;
};

type FakeAgentSignalRunRow = {
  id: string;
  run_status: "failed" | "succeeded";
  tenant_label: string;
  produced_at: string;
  completed_at: string;
  sources_checked: string[] | null;
  source_coverage: unknown;
  total_submitted_signal_count: number;
  accepted_signal_count: number;
  investment_committee_routed_count: number;
  suppressed_meta_admin_count: number;
  suppressed_low_signal_count: number;
  rejected_invalid_count: number;
  error_message: string | null;
  created_at: string;
};

type FakeAgentRunRequestRow = AgentRunRequestRow;

function createEnvelope(): AgentProducedMicrosoft365SignalEnvelope {
  return {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: "2026-06-03T23:07:00Z",
    tenantLabel: "Will O'Donnell",
    status: "succeeded",
    sourcesChecked: ["outlook", "calendar", "teams"],
    signals: [
      {
        id: "teams-budget-blocker",
        source: "teams",
        signalType: "follow_up",
        category: "general",
        attention: "high",
        title: "Budget blocker needs follow-up",
        summary: "A leader is waiting on answers before moving forward.",
        whyItMatters: "Execution is blocked until the issue is resolved.",
        owner: "Will O'Donnell",
        sourceLabel: "Teams DM",
        sourceReference: "Message 1",
        occurredAt: "2026-06-02T17:13:02Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: "Respond and unblock the work.",
        participants: ["Will O'Donnell", "JT Steenkamp"],
        protectedContext: true
      },
      {
        id: "ic-memo",
        source: "outlook",
        signalType: "status",
        category: "IC",
        attention: "low",
        title: "IC memo is approved",
        summary: "Investment Committee approved the memo.",
        whyItMatters: "This belongs in IC.",
        owner: "Susan Pi",
        sourceLabel: "Susan Pi",
        sourceReference: "Approved: Funding Memo",
        occurredAt: "2026-06-03T17:13:29Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: null,
        participants: ["Susan Pi"],
        protectedContext: true
      },
      {
        id: "meta-signal",
        source: "outlook",
        signalType: "status",
        category: "general",
        attention: "medium",
        title: "ChatGPT prompt update discussion",
        summary: "Review the JSON contract for the Priority Inbox implementation process.",
        whyItMatters: "Meta/admin content should be suppressed.",
        owner: "Will O'Donnell",
        sourceLabel: "Codex",
        sourceReference: "Local repo work",
        occurredAt: "2026-06-03T17:13:29Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: null,
        participants: ["Will O'Donnell"],
        protectedContext: false
      }
    ]
  };
}

function createRunRow(
  overrides: Partial<FakeAgentSignalRunRow> = {}
): FakeAgentSignalRunRow {
  return {
    id: "run-1",
    run_status: "succeeded",
    tenant_label: "Will O'Donnell",
    produced_at: "2026-06-03T23:07:00Z",
    completed_at: "2026-06-03T23:10:00Z",
    sources_checked: ["outlook", "calendar", "teams"],
    source_coverage: {},
    total_submitted_signal_count: 3,
    accepted_signal_count: 1,
    investment_committee_routed_count: 1,
    suppressed_meta_admin_count: 1,
    suppressed_low_signal_count: 0,
    rejected_invalid_count: 0,
    error_message: null,
    created_at: "2026-06-03T23:10:00Z",
    ...overrides
  };
}

function createPriorityInboxRow(
  overrides: Partial<PriorityInboxRowWithAgentRun> = {}
): PriorityInboxRowWithAgentRun {
  return {
    id: "priority-item-1",
    user_id: "user-1",
    source: "teams",
    source_label: "Teams DM",
    source_family: "teams",
    ingestion_mode: "agent_run",
    source_link: null,
    external_message_id: "teams-budget-blocker",
    external_thread_id: null,
    received_at: "2026-06-02T17:13:02Z",
    sender: "JT Steenkamp",
    sender_role: "Will O'Donnell",
    thread_title: "Budget blocker needs follow-up",
    primary_line: "Respond and unblock the work.",
    summary: "A leader is waiting on answers before moving forward.",
    time_label: "Jun 2",
    visible_state: "high_priority",
    prior_visible_state: "high_priority",
    deferred_until: null,
    deferred_label: null,
    deferred_reason: null,
    disposition: null,
    disposition_reason: "follow_up_needed",
    disposition_label: null,
    updated_cue: null,
    relationship_cue: null,
    sensitive_context: null,
    attachment_cue: null,
    grouped_cue: null,
    why_surfaced: "Execution is blocked until the issue is resolved.",
    supporting_signals: ["follow_up", "high", "Teams DM"],
    recommended_action: "create_task",
    task_prefill: null,
    commitment_prefill: null,
    initiative_prefill: null,
    reference_prefill: null,
    created_object: null,
    source_metadata: null,
    agent_run_id: null,
    sort_order: 0,
    last_changed_at: "2026-06-03T23:10:00Z",
    created_at: "2026-06-03T23:10:00Z",
    updated_at: "2026-06-03T23:10:00Z",
    ...overrides
  };
}

function createManualRequestRow(
  overrides: Partial<FakeAgentRunRequestRow> = {}
): FakeAgentRunRequestRow {
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

function createResolvedAppUser(params: {
  latestRun: FakeAgentSignalRunRow | null;
  latestSuccessfulRun: FakeAgentSignalRunRow | null;
  items?: PriorityInboxRowWithAgentRun[];
  latestManualRequest?: FakeAgentRunRequestRow | null;
}) {
  const items = params.items ?? [];
  const latestManualRequest = params.latestManualRequest ?? null;
  const client = {
    from(table: string) {
      if (table === "agent_signal_runs") {
        const filters = new Map<string, unknown>();
        return {
          select() {
            return this;
          },
          eq(column: string, value: unknown) {
            filters.set(column, value);
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          async maybeSingle() {
            return {
              data: filters.get("run_status") === "succeeded" ? params.latestSuccessfulRun : params.latestRun,
              error: null
            };
          }
        };
      }

      if (table === "priority_inbox_items") {
        const filters = new Map<string, unknown>();
        return {
          select() {
            return this;
          },
          eq(column: string, value: unknown) {
            filters.set(column, value);
            return this;
          },
          order() {
            return this;
          },
          async returns() {
            return {
              data: items.filter((item) => item.agent_run_id === filters.get("agent_run_id")),
              error: null
            };
          }
        };
      }

      if (table === "agent_run_requests") {
        return {
          update(row: Record<string, unknown>) {
            return {
              eq() {
                return {
                  in() {
                    return {
                      async lt(_column: string, value: string) {
                        if (
                          latestManualRequest &&
                          (latestManualRequest.status === "requested" || latestManualRequest.status === "claimed") &&
                          Date.parse(latestManualRequest.expires_at) < Date.parse(value)
                        ) {
                          latestManualRequest.status = row.status as FakeAgentRunRequestRow["status"];
                          latestManualRequest.completed_at = row.completed_at as string | null;
                        }

                        return {
                          data: latestManualRequest ? [{ id: latestManualRequest.id }] : [],
                          error: null
                        };
                      }
                    };
                  }
                };
              }
            };
          },
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order() {
                        return {
                          limit() {
                            return {
                              async maybeSingle() {
                                return {
                                  data: latestManualRequest,
                                  error: null
                                };
                              }
                            };
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  };

  return {
    client: client as never,
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

test("buildLocalPriorityInboxPageData uses the local payload as a read-only dev fallback", () => {
  const result = buildLocalPriorityInboxPageData(createEnvelope());

  assert.equal(result.sourceMode, "local");
  assert.equal(result.state, "succeeded");
  assert.equal(result.latestRun?.acceptedSignalCount, 1);
  assert.equal(result.latestRun?.investmentCommitteeRoutedCount, 1);
  assert.equal(result.latestRun?.suppressedMetaAdminCount, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.id, "local-teams-budget-blocker");
  assert.equal(result.items[0]?.source, "teams");
  assert.equal(result.items[0]?.sourceMetadata?.localDevFallback, true);
});

test("loadPriorityInboxPageData prefers the database-backed durable run over the local fallback", async () => {
  let fallbackCalls = 0;

  const result = await loadPriorityInboxPageDataWithDeps({
    env: {
      ...process.env,
      NODE_ENV: "development"
    },
    resolveAppUser: async () =>
      createResolvedAppUser({
        latestRun: createRunRow(),
        latestSuccessfulRun: createRunRow(),
        items: [
          createPriorityInboxRow({
            agent_run_id: "run-1"
          })
        ]
      }),
    loadFallbackEnvelope: async () => {
      fallbackCalls += 1;
      return {
        envelope: createEnvelope(),
        source: "local"
      };
    }
  });

  assert.equal(result.sourceMode, "database");
  assert.equal(result.latestRun?.id, "run-1");
  assert.equal(result.latestManualRequest, null);
  assert.equal(result.items.length, 1);
  assert.equal(fallbackCalls, 0);
});

test("local fallback only happens when no durable run exists", async () => {
  const result = await loadPriorityInboxPageDataWithDeps({
    env: {
      ...process.env,
      NODE_ENV: "development"
    },
    resolveAppUser: async () =>
      createResolvedAppUser({
        latestRun: null,
        latestSuccessfulRun: null
      }),
    loadFallbackEnvelope: async () => ({
      envelope: createEnvelope(),
      source: "local"
    })
  });

  assert.equal(result.sourceMode, "local");
  assert.equal(result.latestManualRequest, null);
  assert.equal(result.items[0]?.id, "local-teams-budget-blocker");
});

test("fixture fallback only happens when no durable run exists and no local payload is available", async () => {
  const result = await loadPriorityInboxPageDataWithDeps({
    env: {
      ...process.env,
      NODE_ENV: "development"
    },
    resolveAppUser: async () =>
      createResolvedAppUser({
        latestRun: null,
        latestSuccessfulRun: null
      }),
    loadFallbackEnvelope: async () => ({
      envelope: createEnvelope(),
      source: "fixture"
    })
  });

  assert.equal(result.sourceMode, "fixture");
  assert.equal(result.latestManualRequest, null);
  assert.equal(result.items[0]?.id, "local-teams-budget-blocker");
});

test("production never uses local or fixture fallback when no durable run exists", async () => {
  let fallbackCalls = 0;

  const result = await loadPriorityInboxPageDataWithDeps({
    env: {
      ...process.env,
      NODE_ENV: "production"
    },
    resolveAppUser: async () =>
      createResolvedAppUser({
        latestRun: null,
        latestSuccessfulRun: null
      }),
    loadFallbackEnvelope: async () => {
      fallbackCalls += 1;
      return {
        envelope: createEnvelope(),
        source: "local"
      };
    }
  });

  assert.equal(result.sourceMode, "database");
  assert.equal(result.state, "never_run");
  assert.equal(result.latestRun, null);
  assert.equal(result.latestManualRequest, null);
  assert.deepEqual(result.items, []);
  assert.equal(fallbackCalls, 0);
});

test("loadPriorityInboxPageData exposes the latest manual agent run request", async () => {
  const result = await loadPriorityInboxPageDataWithDeps({
    env: {
      ...process.env,
      NODE_ENV: "development"
    },
    resolveAppUser: async () =>
      createResolvedAppUser({
        latestRun: createRunRow(),
        latestSuccessfulRun: createRunRow(),
        latestManualRequest: createManualRequestRow({
          status: "claimed",
          claimed_at: "2026-06-04T16:05:00Z"
        }),
        items: [
          createPriorityInboxRow({
            agent_run_id: "run-1"
          })
        ]
      }),
    loadFallbackEnvelope: async () => ({
      envelope: createEnvelope(),
      source: "local"
    })
  });

  assert.equal(result.latestManualRequest?.id, "request-1");
  assert.equal(result.latestManualRequest?.status, "claimed");
  assert.equal(result.latestManualRequest?.isActive, true);
});
