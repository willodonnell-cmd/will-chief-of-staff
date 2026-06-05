import assert from "node:assert/strict";
import test from "node:test";

import { handleNativeMicrosoft365RunNowRequest } from "../lib/agent-signals/run-now-route";
import type { AgentSignalsImportSummary } from "../lib/agent-signals/import-agent-signals";
import type {
  MicrosoftGraphConnectionMetadata,
  MicrosoftGraphConnectionRepository
} from "../lib/microsoft-graph/types";
import type { AgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";

const RUN_NOW_ENV = {
  ...process.env,
  MICROSOFT_GRAPH_CLIENT_ID: "client-id",
  MICROSOFT_GRAPH_CLIENT_SECRET: "client-secret",
  MICROSOFT_GRAPH_TOKEN_ENCRYPTION_KEY: "12345678901234567890123456789012"
};

function resolvedUser() {
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

function metadata(): MicrosoftGraphConnectionMetadata {
  return {
    id: "connection-1",
    user_id: "user-1",
    tenant_id: "organizations",
    microsoft_user_id: "microsoft-user-1",
    email: "will@example.com",
    display_name: "Will O'Donnell",
    expires_at: "2099-06-05T13:00:00Z",
    scopes: ["offline_access", "User.Read", "Mail.Read", "Calendars.Read", "Chat.Read"],
    connected_at: "2026-06-05T12:00:00Z",
    last_refreshed_at: null,
    revoked_at: null,
    created_at: "2026-06-05T12:00:00Z",
    updated_at: "2026-06-05T12:00:00Z"
  };
}

function repository(active: boolean): MicrosoftGraphConnectionRepository {
  return {
    client: {} as never,
    async loadActiveConnection() {
      return null;
    },
    async loadActiveConnectionMetadata() {
      return active ? metadata() : null;
    },
    async storeConnection() {
      throw new Error("not used");
    },
    async updateTokens() {
      throw new Error("not used");
    },
    async markRevoked() {
      return 0;
    }
  };
}

function summary(envelope: AgentProducedMicrosoft365SignalEnvelope): AgentSignalsImportSummary {
  return {
    runId: "run-1",
    runStatus: "succeeded",
    producedAt: envelope.producedAt,
    tenantLabel: envelope.tenantLabel,
    sourceCoverage: envelope.sourceCoverage,
    sourcesChecked: envelope.sourcesChecked ?? [],
    windowStart: envelope.windowStart ?? null,
    windowEnd: envelope.windowEnd ?? null,
    submittedSignalCount: envelope.signals.length,
    receivedSignalCount: envelope.signals.length,
    icRoutedSignalCount: 0,
    rejectedSignalCount: 0,
    acceptedSignalCount: 1,
    investmentCommitteeRoutedCount: 0,
    suppressedMetaAdminCount: 0,
    suppressedLowSignalCount: 0,
    rejectedInvalidCount: 0,
    upsertedSourceItemCount: 1,
    upsertedSignalCount: 1,
    upsertedPriorityInboxItemCount: 1,
    signalsBySource: { outlook: 1, calendar: 0, teams: 0 },
    signalsByPriority: { high: 1, medium: 0, low: 0 },
    importedAt: "2026-06-05T13:01:00Z"
  };
}

test("run-now endpoint returns connect-required when Microsoft Graph is not connected", async () => {
  const response = await handleNativeMicrosoft365RunNowRequest(
    new Request("http://localhost/api/agent-signals/run-now", { method: "POST" }),
    {
      env: RUN_NOW_ENV,
      resolveAppUser: async () => resolvedUser(),
      connectionRepository: repository(false)
    }
  );

  assert.equal(response.status, 409);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.code, "microsoft_not_connected");
});

test("run-now endpoint calls runner, imports envelope, returns counts, and never returns tokens", async () => {
  let runnerCalled = false;
  let importCalled = false;
  const response = await handleNativeMicrosoft365RunNowRequest(
    new Request("http://localhost/api/agent-signals/run-now", { method: "POST" }),
    {
      env: RUN_NOW_ENV,
      resolveAppUser: async () => resolvedUser(),
      connectionRepository: repository(true),
      runPull: async () => {
        runnerCalled = true;
        return {
          envelope: {
            producer: "blackhawk_native",
            connectorFamily: "microsoft_365",
            producedAt: "2026-06-05T13:00:00Z",
            tenantLabel: "Blackhawk Microsoft Graph",
            status: "succeeded",
            sourcesChecked: ["outlook", "calendar", "teams"],
            sourceCoverage: {
              outlook: { status: "included", signalCount: 1 },
              calendar: { status: "empty", signalCount: 0 },
              teams: { status: "permission_denied", signalCount: 0, reason: "Chat.Read blocked." }
            },
            signals: [
              {
                id: "outlook-message-1",
                source: "outlook",
                signalType: "follow_up",
                attention: "high",
                title: "Please review customer decision",
                summary: "Can you review this?",
                whyItMatters: "Direct ask.",
                owner: "Will O'Donnell",
                sourceLabel: "Alex",
                sourceReference: "Outlook message",
                occurredAt: "2026-06-05T12:00:00Z",
                dueAt: null,
                sourceUrl: null,
                category: "general",
                actionRequest: "Review it.",
                participants: ["Will O'Donnell", "Alex"],
                protectedContext: true
              }
            ]
          },
          sourceErrors: [
            {
              source: "teams",
              status: "permission_denied",
              reason: "Chat.Read blocked.",
              issueKind: "permission"
            }
          ]
        };
      },
      importPayload: async (envelope) => {
        importCalled = true;
        return summary(envelope as AgentProducedMicrosoft365SignalEnvelope);
      }
    }
  );

  assert.equal(response.status, 200);
  assert.equal(runnerCalled, true);
  assert.equal(importCalled, true);
  const bodyText = await response.text();
  assert.doesNotMatch(bodyText, /token/i);
  const body = JSON.parse(bodyText) as Record<string, unknown>;
  assert.equal(body.runId, "run-1");
  assert.equal(body.acceptedCount, 1);
  assert.equal((body.sourceErrors as Array<Record<string, unknown>>)[0]?.source, "teams");
});
