import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";

import { AgentControlsCard } from "../components/agent-signals/agent-controls-card";
import type { MicrosoftGraphConnectionStatus } from "../lib/microsoft-graph/types";

function collectText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!node || typeof node === "boolean") {
    return "";
  }

  if (Array.isArray(node)) {
    return node.map(collectText).join(" ");
  }

  if (typeof node === "object" && "props" in node) {
    const props = node.props as { children?: ReactNode };
    return collectText(props.children);
  }

  return "";
}

function status(overrides: Partial<MicrosoftGraphConnectionStatus> = {}): MicrosoftGraphConnectionStatus {
  return {
    configured: true,
    state: "not_connected",
    connected: false,
    connectHref: "/api/microsoft/connect",
    accountEmail: null,
    displayName: null,
    scopes: ["offline_access", "User.Read", "Mail.Read", "Calendars.Read", "Chat.Read"],
    expiresAt: null,
    connectedAt: null,
    lastRefreshedAt: null,
    statusLabel: "Microsoft 365 is not connected.",
    missingConfiguration: [],
    ...overrides
  };
}

test("AgentControlsCard shows Connect Microsoft 365 when Graph is not connected", () => {
  const element = AgentControlsCard({
    latestRun: null,
    latestManualRequest: null,
    manualRunRequestsAvailable: true,
    microsoftGraphStatus: status(),
    sourceMode: "database",
    state: "never_run"
  });
  const text = collectText(element);

  assert.match(text, /Connect Microsoft 365/);
  assert.match(text, /Legacy ChatGPT Agent requests remain available/);
});

test("AgentControlsCard shows native Graph run CTA when connected", () => {
  const element = AgentControlsCard({
    latestRun: {
      id: "run-1",
      producer: "blackhawk_native",
      runStatus: "succeeded",
      tenantLabel: "Blackhawk Microsoft Graph",
      producedAt: "2026-06-05T13:00:00Z",
      completedAt: "2026-06-05T13:01:00Z",
      sourcesChecked: ["outlook", "calendar", "teams"],
      sourceCoverage: null,
      totalSubmittedSignalCount: 1,
      acceptedSignalCount: 1,
      investmentCommitteeRoutedCount: 0,
      suppressedMetaAdminCount: 0,
      suppressedLowSignalCount: 0,
      rejectedInvalidCount: 0,
      errorMessage: null
    },
    latestManualRequest: null,
    manualRunRequestsAvailable: true,
    microsoftGraphStatus: status({
      state: "connected",
      connected: true,
      accountEmail: "will@example.com",
      displayName: "Will O'Donnell",
      statusLabel: "Microsoft 365 connected as will@example.com."
    }),
    sourceMode: "database",
    state: "succeeded"
  });
  const text = collectText(element);

  assert.match(text, /Run Now from Microsoft 365/);
  assert.match(text, /Disconnect Microsoft 365/);
  assert.match(text, /will@example.com/);
});
