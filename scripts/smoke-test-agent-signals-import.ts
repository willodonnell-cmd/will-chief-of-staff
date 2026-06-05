import process from "node:process";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type SmokePayload = {
  producer: "chatgpt_agent";
  connectorFamily: "microsoft_365";
  producedAt: string;
  tenantLabel: string;
  status: "succeeded";
  sourcesChecked: ["outlook", "teams"];
  sourceCoverage: {
    outlook: {
      status: "included";
      checkedAt: string;
      signalCount: number;
      reason: string;
    };
    teams: {
      status: "included";
      checkedAt: string;
      signalCount: number;
      reason: string;
    };
  };
  signals: Array<{
    id: string;
    source: "outlook" | "teams";
    signalType: "decision" | "follow_up" | "status";
    attention: "high" | "medium" | "low";
    title: string;
    summary: string;
    whyItMatters: string;
    owner: string;
    sourceLabel: string;
    sourceReference: string | null;
    occurredAt: string;
    dueAt: string | null;
    sourceUrl: string | null;
    category: string | null;
    actionRequest: string | null;
    participants: string[];
    protectedContext: boolean;
  }>;
};

function requiredEnv(name: "BLACKHAWK_BASE_URL" | "AGENT_SIGNALS_IMPORT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function buildPayload(): SmokePayload {
  const producedAt = new Date().toISOString();
  const idSuffix = producedAt.replace(/[^0-9]/g, "");

  return {
    producer: "chatgpt_agent",
    connectorFamily: "microsoft_365",
    producedAt,
    tenantLabel: "Blackhawk smoke test",
    status: "succeeded",
    sourcesChecked: ["outlook", "teams"],
    sourceCoverage: {
      outlook: {
        status: "included",
        checkedAt: producedAt,
        signalCount: 2,
        reason: "Smoke-test Outlook payload."
      },
      teams: {
        status: "included",
        checkedAt: producedAt,
        signalCount: 1,
        reason: "Smoke-test Teams payload."
      }
    },
    signals: [
      {
        id: `smoke-priority-${idSuffix}`,
        source: "outlook",
        signalType: "follow_up",
        attention: "high",
        title: "Smoke test direct follow-up for Will",
        summary: "A sanitized smoke-test follow-up that should land in Priority Inbox.",
        whyItMatters: "Verifies the durable Priority Inbox write path end to end.",
        owner: "Will O'Donnell",
        sourceLabel: "Smoke Test Outlook",
        sourceReference: `smoke-outlook-${idSuffix}`,
        occurredAt: producedAt,
        dueAt: null,
        sourceUrl: null,
        category: "general",
        actionRequest: "Confirm the durable agent import is visible in Priority Inbox.",
        participants: ["Will O'Donnell", "Smoke Test Sender"],
        protectedContext: false
      },
      {
        id: `smoke-ic-${idSuffix}`,
        source: "outlook",
        signalType: "status",
        attention: "medium",
        title: "Smoke test IC memo package",
        summary: "A sanitized smoke-test signal that should route to Investment Committee.",
        whyItMatters: "Verifies IC routing stays out of Priority Inbox.",
        owner: "Susan Pi",
        sourceLabel: "Smoke Test IC",
        sourceReference: `smoke-ic-${idSuffix}`,
        occurredAt: producedAt,
        dueAt: null,
        sourceUrl: null,
        category: "IC",
        actionRequest: null,
        participants: ["Susan Pi", "Will O'Donnell"],
        protectedContext: false
      },
      {
        id: `smoke-low-signal-${idSuffix}`,
        source: "teams",
        signalType: "status",
        attention: "low",
        title: "Smoke test low-signal Teams chatter",
        summary: "Routine FYI chatter with no action needed.",
        whyItMatters: "Verifies low-signal suppression does not pollute Priority Inbox.",
        owner: "Will O'Donnell",
        sourceLabel: "Smoke Test Teams",
        sourceReference: `smoke-teams-${idSuffix}`,
        occurredAt: producedAt,
        dueAt: null,
        sourceUrl: null,
        category: "general",
        actionRequest: null,
        participants: ["Will O'Donnell"],
        protectedContext: false
      }
    ]
  };
}

async function main() {
  const baseUrl = requiredEnv("BLACKHAWK_BASE_URL").replace(/\/+$/, "");
  const secret = requiredEnv("AGENT_SIGNALS_IMPORT_SECRET");
  const payload = buildPayload();

  const response = await fetch(`${baseUrl}/api/agent-signals/import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-signals-import-secret": secret
    },
    body: JSON.stringify(payload)
  });

  const rawBody = await response.text();
  let parsedBody: unknown = null;

  try {
    parsedBody = JSON.parse(rawBody) as unknown;
  } catch {
    parsedBody = rawBody;
  }

  process.stdout.write(`HTTP ${response.status}\n`);
  process.stdout.write(`${JSON.stringify(parsedBody, null, 2)}\n`);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Agent signal import smoke test failed."}\n`);
  process.exit(1);
});
