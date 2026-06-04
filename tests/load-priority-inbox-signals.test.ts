import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPriorityInboxDatabaseResult,
  resolvePriorityInboxSignalEnvelopeWithSource
} from "../lib/agent-signals/priority-inbox-source-resolution";
import type { AgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";

function createEnvelope(
  overrides: Partial<AgentProducedMicrosoft365SignalEnvelope> = {}
): AgentProducedMicrosoft365SignalEnvelope {
  return {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt: "2026-06-02T21:25:00.000Z",
    tenantLabel: "Will O'Donnell Microsoft 365",
    signals: [],
    ...overrides
  };
}

test("priority inbox stays empty when the database has no rows and fixture fallback is disabled", async () => {
  const result = await resolvePriorityInboxSignalEnvelopeWithSource({
    env: {
      NODE_ENV: "development"
    },
    hasLocalPayload: async () => false,
    loadDatabaseSignals: async () => ({
      envelope: createEnvelope(),
      source: "database",
      latestImportedAt: null,
      liveSignalCount: 0
    }),
    loadLocalSignals: async () => {
      throw new Error("fixture fallback should stay disabled");
    }
  });

  assert.equal(result.source, "empty");
  assert.equal(result.envelope.signals.length, 0);
});

test("priority inbox uses the local handoff when the database is empty and a local payload exists", async () => {
  const localEnvelope = createEnvelope({
    producedAt: "2026-06-02T21:30:00.000Z",
    signals: [
      {
        id: "local-signal",
        source: "outlook",
        signalType: "decision",
        attention: "high",
        title: "Local handoff signal",
        summary: "Local summary",
        owner: "Will O'Donnell",
        sourceLabel: "Outlook",
        occurredAt: "2026-06-02T21:20:00.000Z",
        dueAt: null,
        sourceUrl: "https://outlook.office365.com/owa/",
        actionRequest: "Review the local handoff signal.",
        participants: ["Will O'Donnell"],
        protectedContext: false
      }
    ]
  });

  const result = await resolvePriorityInboxSignalEnvelopeWithSource({
    env: {
      NODE_ENV: "development"
    },
    hasLocalPayload: async () => true,
    loadDatabaseSignals: async () => ({
      envelope: createEnvelope(),
      source: "database",
      latestImportedAt: null,
      liveSignalCount: 0
    }),
    loadLocalSignals: async () => ({
      envelope: localEnvelope,
      source: "local"
    })
  });

  assert.equal(result.source, "local");
  assert.equal(result.envelope.signals[0]?.title, "Local handoff signal");
});

test("priority inbox uses the checked-in fixture only when fixture fallback is explicitly enabled", async () => {
  const fixtureEnvelope = createEnvelope({
    producedAt: "2026-05-28T08:15:00.000Z",
    signals: [
      {
        id: "fixture-signal",
        source: "outlook",
        signalType: "decision",
        attention: "high",
        title: "Fixture signal",
        summary: "Fixture summary",
        owner: "Chief of staff",
        sourceLabel: "Outlook",
        occurredAt: "2026-05-28T07:45:00.000Z",
        dueAt: null,
        sourceUrl: "https://outlook.office365.com/owa/",
        actionRequest: "Review the fixture signal.",
        participants: ["Will O'Donnell"],
        protectedContext: false
      }
    ]
  });

  const result = await resolvePriorityInboxSignalEnvelopeWithSource({
    env: {
      NODE_ENV: "development",
      ENABLE_AGENT_SIGNAL_FIXTURE_FALLBACK: "true"
    },
    hasLocalPayload: async () => false,
    loadDatabaseSignals: async () => ({
      envelope: createEnvelope(),
      source: "database",
      latestImportedAt: null,
      liveSignalCount: 0
    }),
    loadLocalSignals: async () => ({
      envelope: fixtureEnvelope,
      source: "fixture"
    })
  });

  assert.equal(result.source, "fixture");
  assert.equal(result.envelope.signals[0]?.title, "Fixture signal");
});

test("database-backed inbox shows only the latest imported batch", async () => {
  const result = buildPriorityInboxDatabaseResult([
    {
      external_signal_id: "outlook-board-packet-scope",
      source: "outlook",
      signal_type: "decision",
      priority: "high",
      title: "Board packet scope changed after hiring-brief revision",
      summary: "Old fixture summary",
      owner: "Chief of staff",
      source_label: "Outlook",
      occurred_at: "2026-05-28T07:45:00.000Z",
      due_at: null,
      source_url: "https://outlook.office365.com/owa/",
      suggested_next_step: "Old fixture action",
      people: ["Will O'Donnell"],
      protected_context: false,
      produced_at: "2026-05-28T08:15:00.000Z",
      imported_at: "2026-05-28T08:16:00.000Z",
      import_source_mode: "fixture_dev",
      tenant_label: "Will O'Donnell Microsoft 365",
      created_at: "2026-05-28T08:16:00.000Z",
      updated_at: "2026-05-28T08:16:00.000Z"
    },
    {
      external_signal_id: "outlook-20260602-grumman-project-island-ficm",
      source: "outlook",
      signal_type: "decision",
      priority: "high",
      title: "600 Grumman Project Island FICM approval is moving forward",
      summary: "Susan Pi says she will approve the $9m Grumman costs.",
      owner: "Will O'Donnell",
      source_label: "Outlook",
      occurred_at: "2026-06-02T21:15:57.000Z",
      due_at: null,
      source_url: "https://outlook.office365.com/owa/",
      suggested_next_step: "Review whether any response or escalation is needed before or after approval proceeds.",
      people: ["Susan Pi", "Will O'Donnell"],
      protected_context: false,
      produced_at: "2026-06-02T21:25:00.000Z",
      imported_at: "2026-06-02T21:30:00.000Z",
      import_source_mode: "database",
      tenant_label: "Will O'Donnell Microsoft 365",
      created_at: "2026-06-02T21:30:00.000Z",
      updated_at: "2026-06-02T21:30:00.000Z"
    },
    {
      external_signal_id: "outlook-20260602-walden-robotics-ic-memo",
      source: "outlook",
      signal_type: "follow_up",
      priority: "high",
      title: "Walden Robotics Series A IC memo is ready for review",
      summary: "The Ventures inbox sent the initial Walden Robotics Series A IC memo.",
      owner: "Will O'Donnell",
      source_label: "Outlook",
      occurred_at: "2026-06-02T21:15:46.000Z",
      due_at: null,
      source_url: "https://outlook.office365.com/owa/",
      suggested_next_step: "Review the Walden Robotics IC memo and decide whether to schedule a follow-up discussion.",
      people: ["Prologis Ventures Inbox", "Will O'Donnell"],
      protected_context: false,
      produced_at: "2026-06-02T21:25:00.000Z",
      imported_at: "2026-06-02T21:30:00.000Z",
      import_source_mode: "database",
      tenant_label: "Will O'Donnell Microsoft 365",
      created_at: "2026-06-02T21:30:00.000Z",
      updated_at: "2026-06-02T21:30:00.000Z"
    },
    {
      external_signal_id: "outlook-20260602-terminal-security-offering",
      source: "outlook",
      signal_type: "status",
      priority: "medium",
      title: "Terminal Security offering may be relevant to Essentials",
      summary: "Lisa Costello forwarded a PLDV update.",
      owner: "PLDV",
      source_label: "Outlook",
      occurred_at: "2026-06-02T20:18:02.000Z",
      due_at: null,
      source_url: "https://outlook.office365.com/owa/",
      suggested_next_step: "Decide whether this should be tracked as an Operations Essentials opportunity or just monitored.",
      people: ["Lisa Costello", "PLDV"],
      protected_context: false,
      produced_at: "2026-06-02T21:25:00.000Z",
      imported_at: "2026-06-02T21:30:00.000Z",
      import_source_mode: "database",
      tenant_label: "Will O'Donnell Microsoft 365",
      created_at: "2026-06-02T21:30:00.000Z",
      updated_at: "2026-06-02T21:30:00.000Z"
    }
  ]);

  assert.equal(result.source, "database");
  assert.equal(result.liveSignalCount, 3);
  assert.deepEqual(
    result.envelope.signals.map((signal) => signal.title),
    [
      "600 Grumman Project Island FICM approval is moving forward",
      "Walden Robotics Series A IC memo is ready for review",
      "Terminal Security offering may be relevant to Essentials"
    ]
  );
});
