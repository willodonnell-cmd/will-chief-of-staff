import assert from "node:assert/strict";
import test from "node:test";

import type { BlackhawkM365SignalAgentConfig } from "../src/blackhawk-m365-signal-agent/config";
import { BlackhawkHttpError } from "../src/blackhawk-m365-signal-agent/clients/blackhawk-client";
import { classifySignalCandidate } from "../src/blackhawk-m365-signal-agent/classifiers/signal-classifier";
import { OutlookCollector } from "../src/blackhawk-m365-signal-agent/collectors/outlook-collector";
import { TeamsCollector } from "../src/blackhawk-m365-signal-agent/collectors/teams-collector";
import { dedupeSignals } from "../src/blackhawk-m365-signal-agent/dedupe/signal-deduper";
import { buildBlackhawkSignalPayload } from "../src/blackhawk-m365-signal-agent/payload/payload-builder";
import { validateBlackhawkSignalPayload } from "../src/blackhawk-m365-signal-agent/payload/validators";
import type {
  CollectorContext,
  CollectorResult,
  Microsoft365Client,
  SignalCandidate,
  SignalCollector
} from "../src/blackhawk-m365-signal-agent/types";
import { buildSignalId } from "../src/blackhawk-m365-signal-agent/utils/ids";
import { RunWorkflow, type BlackhawkClientLike } from "../src/blackhawk-m365-signal-agent/workflows/run-workflow";

function buildConfig(): BlackhawkM365SignalAgentConfig {
  return {
    blackhawkBaseUrl: "https://blackhawk.example.com",
    blackhawkImportSecret: "top-secret",
    m365TenantId: "tenant-1",
    m365ClientId: "client-1",
    m365ClientSecret: "client-secret",
    m365UserIdentifier: "will@example.com",
    timezone: "America/New_York",
    tenantLabel: "Will O'Donnell",
    ownerName: "Will O'Donnell",
    runnerName: "chatgpt_agent",
    logLevel: "error",
    requestTimeoutMs: 5000,
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    reviewWindows: {
      emailLookbackHours: 72,
      teamsLookbackHours: 72,
      calendarLookbackHours: 24,
      calendarLookaheadDays: 7
    }
  };
}

function buildCandidate(overrides: Partial<SignalCandidate> = {}): SignalCandidate {
  return {
    source: "outlook",
    sourceRecordId: "message-1",
    sourceThreadId: "thread-1",
    sourceUrl: "https://example.com/message-1",
    sourceLabel: "Sarah",
    titleSeed: "Revised term sheet needs Will's approval",
    summarySeed: "Sarah is waiting on confirmation before legal proceeds.",
    participants: ["Sarah", "Will O'Donnell"],
    occurredAt: "2026-06-04T12:00:00Z",
    dueAt: "2026-06-05T12:00:00Z",
    directAsk: true,
    waitingOnWill: true,
    decisionRequired: true,
    openLoop: true,
    consequenceKeywords: [],
    relationKeywords: [],
    rawText: "revised term sheet needs will approval investor legal decision",
    protectedContext: true,
    dedupeKeys: ["thread-1", "revised-term-sheet"],
    preferredSurface: undefined,
    likelyResolved: false,
    senderName: "Sarah",
    ...overrides
  };
}

function buildCollectorResult(
  source: CollectorResult["source"],
  candidates: SignalCandidate[],
  overrides: Partial<CollectorResult> = {}
): CollectorResult {
  return {
    source,
    status: candidates.length > 0 ? "included" : "empty",
    checkedAt: "2026-06-04T16:00:00Z",
    candidates,
    reason: candidates.length > 0 ? "Collected candidates." : "No candidates.",
    ...overrides
  };
}

class StubCollector implements SignalCollector {
  readonly source: CollectorResult["source"];
  readonly resultFactory: (context: CollectorContext) => Promise<CollectorResult> | CollectorResult;

  constructor(
    source: CollectorResult["source"],
    resultFactory: (context: CollectorContext) => Promise<CollectorResult> | CollectorResult
  ) {
    this.source = source;
    this.resultFactory = resultFactory;
  }

  async collect(context: CollectorContext) {
    return await this.resultFactory(context);
  }
}

class FakeBlackhawkClient implements BlackhawkClientLike {
  pendingRequests: Array<{
    id: string;
    status: string;
    requestedAt: string;
    expiresAt: string;
    requestContext: Record<string, unknown>;
  }> = [];
  claimCalls: string[] = [];
  completeCalls: Array<{ requestId: string; runId: string }> = [];
  failCalls: Array<{ requestId: string; errorMessage: string }> = [];
  importedPayloads: Array<{
    payload: Awaited<ReturnType<FakeBlackhawkClient["importSignals"]>> extends never ? never : unknown;
    options?: { manualRunRequestId?: string | null; idempotencyKey?: string | null };
  }> = [];
  importImplementation: NonNullable<BlackhawkClientLike["importSignals"]>;

  constructor() {
    this.importImplementation = async () => ({
      runId: "run-1",
      submittedCount: 1,
      acceptedCount: 1,
      investmentCommitteeRoutedCount: 0,
      suppressedCount: 0,
      rejectedCount: 0
    });
  }

  async getPendingRunRequests() {
    return this.pendingRequests;
  }

  async claimRunRequest(requestId: string) {
    this.claimCalls.push(requestId);
    const match = this.pendingRequests.find((request) => request.id === requestId);
    assert.ok(match);
    return match;
  }

  async importSignals(payload: Parameters<BlackhawkClientLike["importSignals"]>[0], options?: Parameters<BlackhawkClientLike["importSignals"]>[1]) {
    this.importedPayloads.push({
      payload,
      options
    });
    return await this.importImplementation(payload, options);
  }

  async completeRunRequest(requestId: string, runId: string) {
    this.completeCalls.push({
      requestId,
      runId
    });
  }

  async retrySafeFailRunRequest(requestId: string, errorMessage: string) {
    this.failCalls.push({
      requestId,
      errorMessage
    });
  }
}

function createWorkflow(params: {
  blackhawkClient?: FakeBlackhawkClient;
  collectors?: SignalCollector[];
  now?: () => string;
}) {
  return new RunWorkflow({
    config: buildConfig(),
    blackhawkClient: params.blackhawkClient ?? new FakeBlackhawkClient(),
    collectors:
      params.collectors ??
      [
        new StubCollector("outlook", () => buildCollectorResult("outlook", [buildCandidate()])),
        new StubCollector("calendar", () => buildCollectorResult("calendar", [])),
        new StubCollector("teams", () => buildCollectorResult("teams", []))
      ],
    now: params.now ?? (() => "2026-06-04T16:00:00Z")
  });
}

test("signal ids are deterministic and source-prefixed", () => {
  const id = buildSignalId("outlook", "A Message ID", ["thread-1", "Title"]);
  assert.equal(id, buildSignalId("outlook", "A Message ID", ["thread-1", "Title"]));
  assert.match(id, /^outlook-/);
});

test("payload validation enforces sourceCoverage count consistency", () => {
  const payload = buildBlackhawkSignalPayload({
    now: "2026-06-04T16:00:00Z",
    tenantLabel: "Will O'Donnell",
    ownerName: "Will O'Donnell",
    windows: buildConfig().reviewWindows,
    sourceResults: [
      buildCollectorResult("outlook", [buildCandidate()]),
      buildCollectorResult("calendar", []),
      buildCollectorResult("teams", [])
    ],
    signals: [classifySignalCandidate(buildCandidate(), "2026-06-04T16:00:00Z")],
    manualRun: null
  });

  const parsed = validateBlackhawkSignalPayload(payload);
  assert.equal(parsed.sourceCoverage.outlook.signalCount, 1);

  assert.throws(() =>
    validateBlackhawkSignalPayload({
      ...payload,
      sourceCoverage: {
        ...payload.sourceCoverage,
        outlook: {
          ...payload.sourceCoverage.outlook,
          signalCount: 99
        }
      }
    })
  );
});

test("classifier routes investment committee items and suppresses resolved low-signal items", () => {
  const ic = classifySignalCandidate(
    buildCandidate({
      source: "outlook",
      rawText: "investment committee prep for portfolio company review and deal review",
      preferredSurface: "investment_committee"
    }),
    "2026-06-04T16:00:00Z"
  );

  assert.equal(ic.routingSurface, "investment_committee");
  assert.equal(ic.attention, "high");

  const suppressed = classifySignalCandidate(
    buildCandidate({
      sourceRecordId: "message-2",
      directAsk: false,
      waitingOnWill: false,
      decisionRequired: false,
      openLoop: false,
      likelyResolved: true,
      dueAt: null,
      rawText: "generic newsletter fyi only"
    }),
    "2026-06-04T16:00:00Z"
  );

  assert.equal(suppressed.routingSurface, "suppress");
  assert.equal(suppressed.attention, "low");
});

test("dedupe merges overlapping signals and preserves the canonical source", () => {
  const calendarSignal = classifySignalCandidate(
    buildCandidate({
      source: "calendar",
      sourceRecordId: "event-1",
      sourceThreadId: "shared-topic",
      titleSeed: "Board prep meeting",
      summarySeed: "Prep needed for the board session.",
      dedupeKeys: ["shared-topic", "board-prep-meeting"],
      rawText: "board prep meeting decision"
    }),
    "2026-06-04T16:00:00Z"
  );

  const teamsSignal = classifySignalCandidate(
    buildCandidate({
      source: "teams",
      sourceRecordId: "chat-message-1",
      sourceThreadId: "shared-topic",
      titleSeed: "Board prep meeting",
      summarySeed: "Team says prep is blocked.",
      dedupeKeys: ["shared-topic", "board-prep-meeting"],
      rawText: "board prep meeting blocked"
    }),
    "2026-06-04T16:00:00Z"
  );

  const deduped = dedupeSignals([teamsSignal, calendarSignal]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.source, "calendar");
  assert.match(deduped[0]?.summary ?? "", /related context/i);
});

test("scheduled workflow success imports one validated payload and returns run counts", async () => {
  const blackhawk = new FakeBlackhawkClient();
  const workflow = createWorkflow({
    blackhawkClient: blackhawk
  });

  const result = await workflow.run();

  assert.equal(result.status, "succeeded");
  assert.equal(result.runId, "run-1");
  assert.equal(blackhawk.importedPayloads.length, 1);
  const imported = blackhawk.importedPayloads[0]?.payload;
  assert.ok(imported);
  const payload = validateBlackhawkSignalPayload(imported);
  assert.equal(payload.manualRunRequestId, undefined);
  assert.equal(payload.signals.length, 1);
});

test("manual workflow uses custom lookback, imports, and completes the request", async () => {
  const blackhawk = new FakeBlackhawkClient();
  blackhawk.pendingRequests = [
    {
      id: "request-1",
      status: "requested",
      requestedAt: "2026-06-04T15:59:00Z",
      expiresAt: "2026-06-04T16:30:00Z",
      requestContext: {
        lookbackHours: 12,
        calendarLookaheadDays: 3
      }
    }
  ];

  let capturedWindows: CollectorContext["windows"] | null = null;
  const workflow = createWorkflow({
    blackhawkClient: blackhawk,
    collectors: [
      new StubCollector("outlook", (context) => {
        capturedWindows = context.windows;
        return buildCollectorResult("outlook", [buildCandidate()]);
      }),
      new StubCollector("calendar", () => buildCollectorResult("calendar", [])),
      new StubCollector("teams", () => buildCollectorResult("teams", []))
    ]
  });

  const result = await workflow.run();

  assert.equal(result.status, "succeeded");
  assert.deepEqual(capturedWindows, {
    emailLookbackHours: 12,
    teamsLookbackHours: 12,
    calendarLookbackHours: 24,
    calendarLookaheadDays: 3
  });
  assert.equal(blackhawk.completeCalls.length, 1);
  const payload = validateBlackhawkSignalPayload(blackhawk.importedPayloads[0]?.payload);
  assert.equal(payload.manualRunRequestId, "request-1");
});

test("manual workflow marks the request failed when import fails", async () => {
  const blackhawk = new FakeBlackhawkClient();
  blackhawk.pendingRequests = [
    {
      id: "request-1",
      status: "requested",
      requestedAt: "2026-06-04T15:59:00Z",
      expiresAt: "2026-06-04T16:30:00Z",
      requestContext: {}
    }
  ];
  blackhawk.importImplementation = async () => {
    throw new BlackhawkHttpError("Import failed.", {
      statusCode: 500,
      responseBody: "{\"error\":\"boom\"}"
    });
  };

  const result = await createWorkflow({
    blackhawkClient: blackhawk
  }).run();

  assert.equal(result.status, "failed");
  assert.equal(blackhawk.failCalls.length, 1);
  assert.equal(blackhawk.completeCalls.length, 0);
});

test("partial source failure still imports a succeeded payload with sourceCoverage errors", async () => {
  const blackhawk = new FakeBlackhawkClient();
  const workflow = createWorkflow({
    blackhawkClient: blackhawk,
    collectors: [
      new StubCollector("outlook", () => buildCollectorResult("outlook", [buildCandidate()])),
      new StubCollector("calendar", () =>
        buildCollectorResult("calendar", [], {
          status: "permission_denied",
          reason: "Calendar access denied."
        })
      ),
      new StubCollector("teams", () => buildCollectorResult("teams", []))
    ]
  });

  const result = await workflow.run();
  assert.equal(result.status, "succeeded");

  const payload = validateBlackhawkSignalPayload(blackhawk.importedPayloads[0]?.payload);
  assert.equal(payload.status, "succeeded");
  assert.equal(payload.sourceCoverage.calendar.status, "permission_denied");
});

test("all source failures still import a failed payload", async () => {
  const blackhawk = new FakeBlackhawkClient();
  const workflow = createWorkflow({
    blackhawkClient: blackhawk,
    collectors: [
      new StubCollector("outlook", () =>
        buildCollectorResult("outlook", [], { status: "error", reason: "Outlook failed." })
      ),
      new StubCollector("calendar", () =>
        buildCollectorResult("calendar", [], { status: "permission_denied", reason: "Calendar denied." })
      ),
      new StubCollector("teams", () =>
        buildCollectorResult("teams", [], { status: "unavailable", reason: "Teams unavailable." })
      )
    ]
  });

  const result = await workflow.run();
  assert.equal(result.status, "succeeded");

  const payload = validateBlackhawkSignalPayload(blackhawk.importedPayloads[0]?.payload);
  assert.equal(payload.status, "failed");
  assert.equal(payload.signals.length, 0);
});

test("import non-2xx handling returns a failed workflow status", async () => {
  const blackhawk = new FakeBlackhawkClient();
  blackhawk.importImplementation = async () => {
    throw new BlackhawkHttpError("Bad gateway.", {
      statusCode: 502,
      responseBody: "{\"error\":\"bad gateway\"}"
    });
  };

  const result = await createWorkflow({
    blackhawkClient: blackhawk
  }).run();

  assert.equal(result.status, "failed");
  assert.equal(result.runId, null);
});

test("zero-signal runs still import a succeeded payload with an empty signal list", async () => {
  const blackhawk = new FakeBlackhawkClient();
  const workflow = createWorkflow({
    blackhawkClient: blackhawk,
    collectors: [
      new StubCollector("outlook", () => buildCollectorResult("outlook", [])),
      new StubCollector("calendar", () => buildCollectorResult("calendar", [])),
      new StubCollector("teams", () => buildCollectorResult("teams", []))
    ]
  });

  const result = await workflow.run();
  assert.equal(result.status, "succeeded");
  const payload = validateBlackhawkSignalPayload(blackhawk.importedPayloads[0]?.payload);
  assert.equal(payload.status, "succeeded");
  assert.deepEqual(payload.signals, []);
});

test("teams collector excludes irrelevant group chats but keeps direct messages", async () => {
  const client: Microsoft365Client = {
    async listInboxMessages() {
      return [];
    },
    async listSentMessages() {
      return [];
    },
    async listCalendarEvents() {
      return [];
    },
    async listTeamsChats() {
      return [
        {
          id: "chat-group-1",
          topic: "social chat",
          chatType: "group",
          members: ["Will O'Donnell", "Alex"]
        },
        {
          id: "chat-dm-1",
          topic: null,
          chatType: "oneOnOne",
          members: ["Will O'Donnell", "Jamie"]
        }
      ];
    },
    async listChatMessages({ chatId }) {
      if (chatId === "chat-group-1") {
        return [
          {
            id: "message-group-1",
            chatId,
            createdAt: "2026-06-04T15:00:00Z",
            fromName: "Alex",
            bodyPreview: "Lunch later?",
            webUrl: null,
            importance: "normal"
          }
        ];
      }

      return [
        {
          id: "message-dm-1",
          chatId,
          createdAt: "2026-06-04T15:00:00Z",
          fromName: "Jamie",
          bodyPreview: "Can you review the budget blocker today?",
          webUrl: null,
          importance: "normal"
        }
      ];
    }
  };

  const collector = new TeamsCollector(client);
  const result = await collector.collect({
    now: "2026-06-04T16:00:00Z",
    windows: buildConfig().reviewWindows,
    tenantLabel: "Will O'Donnell",
    ownerName: "Will O'Donnell",
    userIdentifier: "will@example.com",
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
      child() {
        return this;
      }
    }
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.source, "teams");
});

test("outlook collector uses sent mail to suppress already-resolved open loops", async () => {
  const client: Microsoft365Client = {
    async listInboxMessages() {
      return [
        {
          id: "message-1",
          conversationId: "thread-1",
          internetMessageId: null,
          subject: "Please review the revised memo",
          bodyPreview: "Following up on the revised memo.",
          webLink: null,
          fromName: "Sarah",
          fromAddress: "sarah@example.com",
          toRecipients: ["Will O'Donnell"],
          ccRecipients: [],
          receivedDateTime: "2026-06-04T14:00:00Z",
          sentDateTime: null,
          importance: "high",
          inferenceClassification: "focused",
          isRead: false,
          hasAttachments: false
        }
      ];
    },
    async listSentMessages() {
      return [
        {
          id: "sent-1",
          conversationId: "thread-1",
          internetMessageId: null,
          subject: "Re: Please review the revised memo",
          bodyPreview: "Reviewed and confirmed.",
          webLink: null,
          fromName: "Will O'Donnell",
          fromAddress: "will@example.com",
          toRecipients: ["Sarah"],
          ccRecipients: [],
          receivedDateTime: null,
          sentDateTime: "2026-06-04T14:30:00Z",
          importance: "normal",
          inferenceClassification: "focused",
          isRead: true,
          hasAttachments: false
        }
      ];
    },
    async listCalendarEvents() {
      return [];
    },
    async listTeamsChats() {
      return [];
    },
    async listChatMessages() {
      return [];
    }
  };

  const collector = new OutlookCollector(client);
  const result = await collector.collect({
    now: "2026-06-04T16:00:00Z",
    windows: buildConfig().reviewWindows,
    tenantLabel: "Will O'Donnell",
    ownerName: "Will O'Donnell",
    userIdentifier: "will@example.com",
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {},
      child() {
        return this;
      }
    }
  });

  assert.equal(result.status, "empty");
  assert.equal(result.candidates.length, 0);
});
