import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentSignalUpsertRow,
  buildSourceItemUpsertRow,
  importAgentSignals,
  type AgentSignalRunInsertRow,
  type AgentSignalRunUpdateRow,
  type AgentSignalUpsertRow,
  type AgentSignalsImportRepository,
  type SourceItemUpsertRow
} from "../lib/agent-signals/import-agent-signals";
import { routeAgentSignal } from "../lib/agent-signals/routing";
import { MicrosoftGraphRequestError, type MicrosoftGraphClient } from "../lib/microsoft-graph/client";
import { runMicrosoft365SignalPullForUser } from "../lib/microsoft-365-signal-runner";

function createFakeGraphClient(): MicrosoftGraphClient {
  return {
    async getJsonPages<TItem>(path: string): Promise<TItem[]> {
      if (path.includes("/mailFolders/inbox/messages")) {
        return [
          {
            id: "message-ask",
            conversationId: "conversation-ask",
            subject: "Please approve partner budget decision",
            sender: { emailAddress: { name: "Alex Partner" } },
            from: { emailAddress: { name: "Alex Partner" } },
            toRecipients: [{ emailAddress: { name: "Will O'Donnell" } }],
            ccRecipients: [],
            receivedDateTime: "2026-06-05T12:00:00Z",
            webLink: "https://outlook/message-ask",
            bodyPreview: "Can you approve the partner budget before the board review?",
            importance: "high",
            hasAttachments: false,
            categories: []
          },
          {
            id: "message-newsletter",
            subject: "Weekly newsletter",
            sender: { emailAddress: { name: "Newsletter" } },
            from: { emailAddress: { name: "Newsletter" } },
            receivedDateTime: "2026-06-05T11:00:00Z",
            bodyPreview: "Generic FYI only. Unsubscribe here.",
            importance: "normal",
            hasAttachments: false,
            categories: []
          },
          {
            id: "message-ic",
            subject: "IC package approval memo",
            sender: { emailAddress: { name: "Susan Pi" } },
            from: { emailAddress: { name: "Susan Pi" } },
            receivedDateTime: "2026-06-05T10:00:00Z",
            bodyPreview: "Investment Committee approval package is ready.",
            importance: "normal",
            hasAttachments: true,
            categories: ["IC"]
          }
        ] as TItem[];
      }

      if (path.includes("/calendarView")) {
        return [
          {
            id: "event-board",
            subject: "Board prep",
            organizer: { emailAddress: { name: "Noemy Peev" } },
            attendees: [{ emailAddress: { name: "Will O'Donnell" } }],
            start: { dateTime: "2026-06-06T15:00:00", timeZone: "UTC" },
            end: { dateTime: "2026-06-06T16:00:00", timeZone: "UTC" },
            bodyPreview: "Prepare customer and strategy discussion.",
            importance: "high",
            isOnlineMeeting: true
          }
        ] as TItem[];
      }

      if (path.includes("/me/chats")) {
        throw new MicrosoftGraphRequestError("Teams denied", 403, "Forbidden", "permission");
      }

      return [];
    }
  } as MicrosoftGraphClient;
}

function createMemoryRepository() {
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
    async listExistingSignalStatuses() {
      return new Map();
    },
    async upsertSourceItems(rows) {
      for (const row of rows) {
        const key = `${row.user_id}:${row.source_type}:${row.external_id}`;
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
    agentSignals,
    priorityInboxItems
  };
}

test("native runner combines source coverage and emits a valid Blackhawk-native envelope", async () => {
  const result = await runMicrosoft365SignalPullForUser({
    userId: "user-1",
    now: "2026-06-05T13:00:00Z",
    graphClient: createFakeGraphClient()
  });

  assert.equal(result.envelope.producer, "blackhawk_native");
  assert.equal(result.envelope.connectorFamily, "microsoft_365");
  assert.equal(result.envelope.sourceCoverage?.outlook?.status, "included");
  assert.equal(result.envelope.sourceCoverage?.calendar?.status, "included");
  assert.equal(result.envelope.sourceCoverage?.teams?.status, "permission_denied");
  assert.equal(result.envelope.signals.some((signal) => signal.id === "outlook-message-ask"), true);
});

test("native runner output routes obvious junk and IC material through existing import logic", async () => {
  const result = await runMicrosoft365SignalPullForUser({
    userId: "user-1",
    now: "2026-06-05T13:00:00Z",
    graphClient: createFakeGraphClient()
  });
  const memory = createMemoryRepository();
  const summary = await importAgentSignals(result.envelope, {
    repository: memory.repository,
    importedAt: "2026-06-05T13:01:00Z"
  });

  assert.equal(summary.runStatus, "succeeded");
  assert.equal(memory.runs.get("run-1")?.producer, "blackhawk_native");
  assert.equal(summary.investmentCommitteeRoutedCount >= 1, true);
  assert.equal(summary.suppressedLowSignalCount >= 1, true);
  assert.equal(summary.acceptedSignalCount >= 1, true);

  const newsletter = memory.agentSignals.get("outlook-message-newsletter");
  assert.equal(newsletter?.row.routing_outcome, "suppressed_low_signal");
  const ic = memory.agentSignals.get("outlook-message-ic");
  assert.equal(ic?.row.routing_outcome, "investment_committee");
});

test("source row and signal row builders preserve native Graph signal metadata", async () => {
  const result = await runMicrosoft365SignalPullForUser({
    userId: "user-1",
    now: "2026-06-05T13:00:00Z",
    graphClient: createFakeGraphClient()
  });
  const signal = result.envelope.signals[0];
  assert.ok(signal);

  const sourceRow = buildSourceItemUpsertRow("user-1", signal);
  const route = routeAgentSignal(signal);
  const signalRow = buildAgentSignalUpsertRow({
    userId: "user-1",
    runId: "run-1",
    signal,
    route,
    envelope: result.envelope,
    sourceItemId: "source-item-1",
    importedAt: "2026-06-05T13:01:00Z",
    importSourceMode: "agent_run"
  });

  assert.equal(sourceRow.raw_payload.metadata?.nativeGraph, true);
  assert.equal(signalRow.raw_payload.metadata?.nativeGraph, true);
});
