import test from "node:test";
import assert from "node:assert/strict";

import {
  AgentSignalsImportValidationError,
  buildAgentSignalUpsertRow,
  buildSourceItemUpsertRow,
  importAgentSignals,
  writePriorityInboxItemsWithoutConflictTarget,
  type AgentSignalRunInsertRow,
  type AgentSignalRunUpdateRow,
  type AgentSignalUpsertRow,
  type AgentSignalsImportRepository,
  type SourceItemUpsertRow
} from "../lib/agent-signals/import-agent-signals";
import { handleAgentSignalsImportRequest } from "../lib/agent-signals/import-route";
import type { AgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";

function buildEnvelope(): AgentProducedMicrosoft365SignalEnvelope {
  return {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: "2026-06-03T23:07:00Z",
    tenantLabel: "Will O'Donnell",
    status: "succeeded",
    sourcesChecked: ["outlook", "calendar", "teams"],
    windowStart: "2026-05-31T23:07:00Z",
    windowEnd: "2026-06-10T23:07:00Z",
    sourceCoverage: {
      outlook: {
        status: "included",
        checkedAt: "2026-06-03T23:07:00Z",
        signalCount: 3,
        reason: "Reviewed Outlook mail."
      },
      calendar: {
        status: "included",
        checkedAt: "2026-06-03T23:07:00Z",
        signalCount: 1,
        reason: "Reviewed Calendar."
      },
      teams: {
        status: "included",
        checkedAt: "2026-06-03T23:07:00Z",
        signalCount: 1,
        reason: "Reviewed direct messages."
      }
    },
    signals: [
      {
        id: "jt-rental-business-budget-blocker",
        source: "teams",
        signalType: "follow_up",
        category: "general",
        attention: "high",
        title: "JT is escalating unresolved rental business and R&D budget concerns",
        summary: "JT says unanswered questions are blocking participation.",
        whyItMatters: "Leadership friction is creating execution risk.",
        owner: "Will O'Donnell",
        sourceLabel: "Teams DM with JT Steenkamp",
        sourceReference: "Teams DM 1780420382231",
        occurredAt: "2026-06-02T17:13:02Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: "Follow up with JT and the relevant owner.",
        participants: ["Will O'Donnell", "JT Steenkamp"],
        protectedContext: true
      },
      {
        id: "june-10-leadership-ai-energy-conflict",
        source: "calendar",
        signalType: "meeting",
        category: "general",
        attention: "high",
        title: "June 10 has overlapping strategic meetings at 11:00 a.m. EDT",
        summary: "Energy Solutions, AI SteerCo, and Q2 Leadership overlap.",
        whyItMatters: "The overlap forces a prioritization decision across strategic topics.",
        owner: "Will O'Donnell",
        sourceLabel: "Outlook Calendar",
        sourceReference: "Energy Solutions / AI SteerCo / Q2 Leadership",
        occurredAt: "2026-06-10T15:00:00Z",
        dueAt: "2026-06-10T15:00:00Z",
        sourceUrl: null,
        actionRequest: "Decide which meeting Will should attend.",
        participants: ["Will O'Donnell", "Noemy Peev"],
        protectedContext: false
      },
      {
        id: "hayward-39-43-ic-approval",
        source: "outlook",
        signalType: "status",
        category: "IC",
        attention: "low",
        title: "Hayward 39/43 funding memo received IC approval",
        summary: "Susan Pi notified the IC approval distribution.",
        whyItMatters: "This belongs in Investment Committee rather than Priority Inbox.",
        owner: "Susan Pi",
        sourceLabel: "Susan Pi",
        sourceReference: "Approved: Hayward 39/43 - Funding Memo",
        occurredAt: "2026-06-03T17:13:29Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: null,
        participants: ["Susan Pi", "Will O'Donnell"],
        protectedContext: true
      },
      {
        id: "prompt-contract-cleanup",
        source: "outlook",
        signalType: "follow_up",
        category: "general",
        attention: "medium",
        title: "Update the JSON contract for the agent handoff",
        summary: "Prompt writing and Goal Contract cleanup are still open.",
        whyItMatters: "This is meta workflow setup, not executive work.",
        owner: "Will O'Donnell",
        sourceLabel: "ChatGPT Agent",
        sourceReference: "Goal Contract notes",
        occurredAt: "2026-06-03T18:00:00Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: "Refine the prompt and JSON contract.",
        participants: ["Will O'Donnell"],
        protectedContext: false
      },
      {
        id: "newsletter-status-fyi",
        source: "outlook",
        signalType: "status",
        category: "general",
        attention: "low",
        title: "Generic update newsletter",
        summary: "FYI only generic update with no action needed.",
        whyItMatters: "This is not important for foreground attention.",
        owner: "Will O'Donnell",
        sourceLabel: "Newsletter",
        sourceReference: "Weekly FYI",
        occurredAt: "2026-06-03T19:00:00Z",
        dueAt: null,
        sourceUrl: null,
        actionRequest: null,
        participants: ["Will O'Donnell"],
        protectedContext: false
      }
    ]
  };
}

function buildMemoryRepository() {
  const runs = new Map<string, AgentSignalRunInsertRow & { id: string }>();
  const sourceItems = new Map<string, { id: string; row: SourceItemUpsertRow }>();
  const agentSignals = new Map<string, { id: string; row: AgentSignalUpsertRow }>();
  const priorityInboxItems = new Map<string, Record<string, unknown>>();
  let nextRunId = 1;
  let nextSourceItemId = 1;
  let nextAgentSignalId = 1;

  const repository: AgentSignalsImportRepository = {
    userId: "user-1",
    async createRun(row) {
      const id = `run-${nextRunId++}`;
      runs.set(id, { id, ...row });
      return { id };
    },
    async updateRun(runId, row) {
      const existing = runs.get(runId);
      assert.ok(existing);
      runs.set(runId, { ...existing, ...(row as AgentSignalRunUpdateRow) });
    },
    async listExistingSignalStatuses(externalSignalIds) {
      return new Map(
        externalSignalIds.flatMap((externalSignalId) => {
          const existing = agentSignals.get(externalSignalId);
          return existing ? [[externalSignalId, existing.row.status] as const] : [];
        })
      );
    },
    async upsertSourceItems(rows) {
      for (const row of rows) {
        const key = `${row.user_id}:${row.source_system}:${row.source_type}:${row.external_id}`;
        const existing = sourceItems.get(key);
        sourceItems.set(key, {
          id: existing?.id ?? `source-item-${nextSourceItemId++}`,
          row
        });
      }

      return [...sourceItems.values()].map((entry) => ({
        id: entry.id,
        source_type: entry.row.source_type,
        external_id: entry.row.external_id
      }));
    },
    async upsertAgentSignals(rows) {
      for (const row of rows) {
        const existing = agentSignals.get(row.external_signal_id);
        agentSignals.set(row.external_signal_id, {
          id: existing?.id ?? `agent-signal-${nextAgentSignalId++}`,
          row
        });
      }

      return [...agentSignals.entries()].map(([externalSignalId, entry]) => ({
        id: entry.id,
        externalSignalId,
        routingOutcome: entry.row.routing_outcome,
        status: entry.row.status,
        title: entry.row.title,
        summary: entry.row.summary,
        priority: entry.row.priority,
        signalType: entry.row.signal_type,
        suggestedNextStep: entry.row.suggested_next_step,
        people: entry.row.people,
        occurredAt: entry.row.occurred_at,
        sourceItemId: entry.row.source_item_id,
        source: entry.row.source
      }));
    },
    async upsertPriorityInboxItems(rows) {
      for (const row of rows) {
        priorityInboxItems.set(`${row.user_id}:${row.agent_signal_id}`, row);
      }

      return rows.length;
    }
  };

  return {
    repository,
    runs,
    sourceItems,
    agentSignals,
    priorityInboxItems
  };
}

function getJsonBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function createPriorityInboxItemUpsertRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: "user-1",
    source: "teams" as const,
    source_label: "Teams DM",
    source_family: "teams" as const,
    ingestion_mode: "agent_run" as const,
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
    visible_state: "high_priority" as const,
    prior_visible_state: "high_priority" as const,
    deferred_until: null,
    deferred_label: null,
    deferred_reason: null,
    disposition: null,
    disposition_reason: "follow_up_needed" as const,
    disposition_label: null,
    updated_cue: null,
    relationship_cue: null,
    sensitive_context: null,
    attachment_cue: null,
    grouped_cue: null,
    why_surfaced: "Execution is blocked until the issue is resolved.",
    supporting_signals: ["follow_up", "high", "Teams DM"],
    recommended_action: "create_task" as const,
    task_prefill: null,
    commitment_prefill: null,
    initiative_prefill: null,
    reference_prefill: null,
    created_object: null,
    source_metadata: {},
    agent_signal_id: "agent-signal-1",
    agent_run_id: "run-1",
    sort_order: 0,
    last_changed_at: "2026-06-03T23:10:00.000Z",
    ...overrides
  };
}

test("maps source item rows from a parsed signal", async () => {
  const envelope = buildEnvelope();
  const signal = envelope.signals[0];

  assert.ok(signal);

  const sourceItemRow = buildSourceItemUpsertRow("user-1", signal);

  assert.equal(sourceItemRow.user_id, "user-1");
  assert.equal(sourceItemRow.source_type, signal.source);
  assert.equal(sourceItemRow.external_id, signal.id);
  assert.equal(sourceItemRow.snippet, signal.summary);
  assert.deepEqual(sourceItemRow.participants, signal.participants);
});

test("maps agent signal rows with routing metadata", async () => {
  const envelope = buildEnvelope();
  const signal = envelope.signals[0];

  assert.ok(signal);

  const row = buildAgentSignalUpsertRow({
    userId: "user-1",
    runId: "run-1",
    signal,
    route: {
      outcome: "priority_inbox",
      reason: "Signal is eligible for the Priority Inbox.",
      investmentCommitteeMatchedCues: [],
      requiresDirectWillAction: false
    },
    envelope,
    sourceItemId: "source-item-1",
    importedAt: "2026-06-03T23:10:00.000Z",
    importSourceMode: "agent_run"
  });

  assert.equal(row.user_id, "user-1");
  assert.equal(row.run_id, "run-1");
  assert.equal(row.routing_outcome, "priority_inbox");
  assert.equal(row.why_it_matters, signal.whyItMatters);
  assert.equal(row.source_reference, signal.sourceReference);
});

test("importing an agent run creates a durable run, audits all signals, and materializes only accepted inbox items", async () => {
  const envelope = buildEnvelope();
  const memory = buildMemoryRepository();

  const summary = await importAgentSignals(envelope, {
    repository: memory.repository,
    importedAt: "2026-06-03T23:10:00.000Z"
  });

  assert.equal(summary.runStatus, "succeeded");
  assert.equal(summary.submittedSignalCount, 5);
  assert.equal(summary.receivedSignalCount, 5);
  assert.equal(summary.icRoutedSignalCount, 1);
  assert.equal(summary.rejectedSignalCount, 0);
  assert.equal(summary.acceptedSignalCount, 2);
  assert.equal(summary.investmentCommitteeRoutedCount, 1);
  assert.equal(summary.suppressedMetaAdminCount, 1);
  assert.equal(summary.suppressedLowSignalCount, 1);
  assert.equal(summary.rejectedInvalidCount, 0);
  assert.equal(summary.upsertedSourceItemCount, 5);
  assert.equal(summary.upsertedSignalCount, 5);
  assert.equal(summary.upsertedPriorityInboxItemCount, 2);
  assert.equal(memory.runs.size, 1);
  assert.equal(memory.agentSignals.size, 5);
  assert.equal(memory.priorityInboxItems.size, 2);

  const icSignal = memory.agentSignals.get("hayward-39-43-ic-approval");
  assert.ok(icSignal);
  assert.equal(icSignal.row.routing_outcome, "investment_committee");

  const metaSignal = memory.agentSignals.get("prompt-contract-cleanup");
  assert.ok(metaSignal);
  assert.equal(metaSignal.row.routing_outcome, "suppressed_meta_admin");

  const lowSignal = memory.agentSignals.get("newsletter-status-fyi");
  assert.ok(lowSignal);
  assert.equal(lowSignal.row.routing_outcome, "suppressed_low_signal");

  assert.equal(
    [...memory.priorityInboxItems.values()].some((row) => row.external_message_id === "hayward-39-43-ic-approval"),
    false
  );
});

test("valid import secret with a valid payload returns success", async () => {
  const payload = buildEnvelope();

  const response = await handleAgentSignalsImportRequest(
    new Request("http://localhost/api/agent-signals/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-signals-import-secret": "top-secret"
      },
      body: JSON.stringify(payload)
    }),
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      importPayload: async () => ({
        runId: "run-1",
        runStatus: "succeeded",
        producedAt: payload.producedAt,
        tenantLabel: payload.tenantLabel,
        sourceCoverage: payload.sourceCoverage,
        sourcesChecked: payload.sourcesChecked ?? [],
        windowStart: payload.windowStart ?? null,
        windowEnd: payload.windowEnd ?? null,
        submittedSignalCount: payload.signals.length,
        receivedSignalCount: payload.signals.length,
        icRoutedSignalCount: 1,
        rejectedSignalCount: 0,
        acceptedSignalCount: 2,
        investmentCommitteeRoutedCount: 1,
        suppressedMetaAdminCount: 1,
        suppressedLowSignalCount: 1,
        rejectedInvalidCount: 0,
        upsertedSourceItemCount: 5,
        upsertedSignalCount: 5,
        upsertedPriorityInboxItemCount: 2,
        signalsBySource: {
          outlook: 3,
          teams: 1,
          calendar: 1
        },
        signalsByPriority: {
          high: 2,
          medium: 1,
          low: 2
        },
        importedAt: "2026-06-03T23:10:00.000Z"
      })
    }
  );

  assert.equal(response.status, 200);
  const body = await getJsonBody(response);
  assert.equal(body.runId, "run-1");
  assert.equal(body.submittedSignalCount, 5);
  assert.equal(body.acceptedSignalCount, 2);
});

test("missing import secret returns 401", async () => {
  const response = await handleAgentSignalsImportRequest(
    new Request("http://localhost/api/agent-signals/import", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    }),
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      importPayload: async () => {
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(response.status, 401);
});

test("invalid import secret returns 401", async () => {
  const response = await handleAgentSignalsImportRequest(
    new Request("http://localhost/api/agent-signals/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-signals-import-secret": "wrong-secret"
      },
      body: JSON.stringify({})
    }),
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      importPayload: async () => {
        throw new Error("should not be called");
      }
    }
  );

  assert.equal(response.status, 401);
});

test("valid import secret with an invalid payload returns 400", async () => {
  const response = await handleAgentSignalsImportRequest(
    new Request("http://localhost/api/agent-signals/import", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-signals-import-secret": "top-secret"
      },
      body: JSON.stringify({ producer: "chatgpt_agent" })
    }),
    {
      env: {
        ...process.env,
        AGENT_SIGNALS_IMPORT_SECRET: "top-secret"
      },
      importPayload: async () => {
        throw new AgentSignalsImportValidationError("signals must be an array.");
      }
    }
  );

  assert.equal(response.status, 400);
  const body = await getJsonBody(response);
  assert.equal(body.error, "signals must be an array.");
});

test("priority_inbox_items write path inserts and updates without relying on an ON CONFLICT target", async () => {
  const operations: string[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, "priority_inbox_items");
      return {
        select(selection: string) {
          assert.equal(selection, "id, agent_signal_id");
          operations.push("select-existing");
          return {
            eq(column: string, value: unknown) {
              assert.equal(column, "user_id");
              assert.equal(value, "user-1");
              return {
                in(nextColumn: string, values: unknown[]) {
                  assert.equal(nextColumn, "agent_signal_id");
                  assert.deepEqual(values, ["agent-signal-1", "agent-signal-2"]);
                  return {
                    async returns() {
                      return {
                        data: [{ id: "priority-item-1", agent_signal_id: "agent-signal-1" }],
                        error: null
                      };
                    }
                  };
                }
              };
            }
          };
        },
        insert(rows: unknown[]) {
          operations.push(`insert:${rows.length}`);
          assert.equal((rows[0] as { agent_signal_id: string }).agent_signal_id, "agent-signal-2");
          return {
            async select() {
              return {
                data: [{ id: "priority-item-2" }],
                error: null
              };
            }
          };
        },
        update(row: unknown) {
          operations.push(`update:${(row as { agent_signal_id: string }).agent_signal_id}`);
          return {
            eq(column: string, value: unknown) {
              assert.equal(column, "user_id");
              assert.equal(value, "user-1");
              return {
                eq(nextColumn: string, nextValue: unknown) {
                  assert.equal(nextColumn, "id");
                  assert.equal(nextValue, "priority-item-1");
                  return {
                    async select() {
                      return {
                        data: [{ id: "priority-item-1" }],
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

  const count = await writePriorityInboxItemsWithoutConflictTarget({
    client: client as never,
    userId: "user-1",
    rows: [
      createPriorityInboxItemUpsertRow(),
      createPriorityInboxItemUpsertRow({
        agent_signal_id: "agent-signal-2",
        external_message_id: "teams-budget-blocker-2"
      })
    ]
  });

  assert.equal(count, 2);
  assert.deepEqual(operations, ["select-existing", "insert:1", "update:agent-signal-1"]);
});
