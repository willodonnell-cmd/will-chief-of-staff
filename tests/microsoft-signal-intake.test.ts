import test from "node:test";
import assert from "node:assert/strict";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  deriveAgentHandoffSourceStatus,
  getMicrosoftSourceModeLabel
} from "../lib/agent-handoff-source-status";
import {
  getDisplaySourceHref,
  isConnectorHealthSignal,
  sanitizeDisplayText,
  stripMarkdownLinks
} from "../lib/agent-signal-brief";
import {
  buildNoteCaptureDraftFromSignal,
  buildTaskCaptureDraftFromSignal,
  mapSignalAttentionToTaskPriority
} from "../lib/signal-capture-drafts";
import {
  LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH,
  LOCAL_MICROSOFT_365_FIXTURE_URL,
  loadLocalAgentProducedMicrosoft365SignalEnvelope,
  loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource,
  parseAgentProducedMicrosoft365SignalEnvelope,
  type Microsoft365SourceCoverage
} from "../lib/microsoft-signal-intake";
import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES,
  CHIEF_OF_STAFF_SIGNAL_TYPES,
  type ChiefOfStaffSignal
} from "../lib/chief-of-staff-signal";
import { adaptMicrosoft365SignalsToPrototypeDailyBrief } from "../lib/prototype-daily-brief";
import { runMicrosoftSignalIntakeWorkflow } from "../trigger/microsoft-signal-intake";

async function loadFixtureObject() {
  const contents = await readFile(LOCAL_MICROSOFT_365_FIXTURE_URL, "utf8");
  return JSON.parse(contents) as { signals?: unknown[]; [key: string]: unknown };
}

async function removeLocalAgentPayload() {
  await rm(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH, { force: true });
  await rm(dirname(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH), {
    force: true,
    recursive: true
  });
}

async function snapshotLocalAgentPayload() {
  try {
    return await readFile(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH, "utf8");
  } catch {
    return null;
  }
}

async function restoreLocalAgentPayload(contents: string | null) {
  if (contents === null) {
    await removeLocalAgentPayload();
    return;
  }

  await mkdir(dirname(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH), { recursive: true });
  await writeFile(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH, contents, "utf8");
}

function buildSignal(overrides: Partial<ChiefOfStaffSignal>): ChiefOfStaffSignal {
  return {
    id: "signal-1",
    source: "teams",
    signalType: "status",
    attention: "medium",
    title: "Default status signal",
    summary: "Default summary",
    owner: "Chief of Staff",
    sourceLabel: "Teams connector",
    occurredAt: "2026-05-28T16:00:00.000Z",
    dueAt: null,
    sourceUrl: null,
    actionRequest: null,
    participants: [],
    protectedContext: false,
    ...overrides
  };
}

function buildSourceCoverage(
  overrides: Partial<Microsoft365SourceCoverage> = {}
): Microsoft365SourceCoverage {
  return {
    outlook: {
      status: "included",
      checkedAt: "2026-05-28T08:10:00.000Z",
      signalCount: 1,
      reason: "Outlook was reviewed and produced one signal."
    },
    calendar: {
      status: "empty",
      checkedAt: "2026-05-28T08:08:00.000Z",
      signalCount: 0,
      reason: "Calendar was checked and had no relevant signals."
    },
    teams: {
      status: "permission_denied",
      checkedAt: "2026-05-28T08:06:00.000Z",
      signalCount: 0,
      reason: "Teams scope was denied."
    },
    ...overrides
  };
}

test("parses the local ChatGPT Agent Microsoft 365 payload", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);
  const dailyBrief = adaptMicrosoft365SignalsToPrototypeDailyBrief(envelope);

  assert.equal(envelope.producer, "chatgpt_agent");
  assert.equal(envelope.connectorFamily, "microsoft_365");
  assert.equal(typeof envelope.tenantLabel, "string");
  assert.notEqual(envelope.tenantLabel.trim(), "");
  assert.deepEqual(envelope.sourceCoverage, {
    outlook: {
      status: "included",
      checkedAt: "2026-05-28T08:10:00.000Z",
      signalCount: 1,
      reason: "Thread review produced one high-leverage decision signal."
    },
    calendar: {
      status: "included",
      checkedAt: "2026-05-28T08:08:00.000Z",
      signalCount: 1,
      reason: "Upcoming board prep meeting produced one consequential meeting signal."
    },
    teams: {
      status: "included",
      checkedAt: "2026-05-28T08:06:00.000Z",
      signalCount: 1,
      reason: "Recent Teams activity produced one status signal."
    }
  });
  assert.ok(envelope.signals.length > 0);
  assert.ok(
    envelope.signals.some((signal) => CHIEF_OF_STAFF_SIGNAL_SOURCES.includes(signal.source))
  );
  assert.ok(envelope.signals.some((signal) => signal.source === "outlook"));
  assert.ok(envelope.signals.some((signal) => signal.source === "teams"));
  assert.ok(envelope.signals.some((signal) => signal.source === "calendar"));

  for (const signal of envelope.signals) {
    assert.ok(CHIEF_OF_STAFF_SIGNAL_SOURCES.includes(signal.source));
    assert.ok(CHIEF_OF_STAFF_SIGNAL_TYPES.includes(signal.signalType));
    assert.ok(CHIEF_OF_STAFF_SIGNAL_ATTENTION.includes(signal.attention));
    assert.equal(typeof signal.title, "string");
    assert.notEqual(signal.title.trim(), "");
    assert.equal(typeof signal.summary, "string");
    assert.notEqual(signal.summary.trim(), "");
    assert.equal(typeof signal.owner, "string");
    assert.notEqual(signal.owner.trim(), "");
    assert.equal(typeof signal.sourceLabel, "string");
    assert.notEqual(signal.sourceLabel.trim(), "");
    assert.equal(typeof signal.occurredAt, "string");
    assert.ok(!Number.isNaN(Date.parse(signal.occurredAt)));
    assert.ok(Array.isArray(signal.participants));
    assert.equal(typeof signal.protectedContext, "boolean");
  }

  assert.equal(typeof dailyBrief.brief.highFocusTitle, "string");
  assert.notEqual(dailyBrief.brief.highFocusTitle.trim(), "");
  assert.equal(dailyBrief.sourceSignals.length, envelope.signals.length);
});

test("envelope without sourceCoverage still validates", async () => {
  const fixture = await loadFixtureObject();
  delete fixture.sourceCoverage;

  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);

  assert.equal(envelope.sourceCoverage, undefined);
});

test("envelope with valid sourceCoverage validates", async () => {
  const fixture = await loadFixtureObject();
  fixture.sourceCoverage = buildSourceCoverage();

  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);

  assert.equal(envelope.sourceCoverage?.outlook?.status, "included");
  assert.equal(envelope.sourceCoverage?.calendar?.status, "empty");
  assert.equal(envelope.sourceCoverage?.teams?.status, "permission_denied");
});

test("invalid sourceCoverage status fails validation", async () => {
  const fixture = await loadFixtureObject();
  fixture.sourceCoverage = {
    ...buildSourceCoverage(),
    calendar: {
      status: "partial"
    }
  } as unknown;

  assert.throws(() => parseAgentProducedMicrosoft365SignalEnvelope(fixture), {
    message:
      "sourceCoverage.calendar.status must be one of: included, empty, skipped, unavailable, permission_denied, error, unknown."
  });
});

test("unknown sourceCoverage key fails validation", async () => {
  const fixture = await loadFixtureObject();
  fixture.sourceCoverage = {
    ...buildSourceCoverage(),
    sharepoint: {
      status: "included"
    }
  };

  assert.throws(() => parseAgentProducedMicrosoft365SignalEnvelope(fixture), {
    message: "sourceCoverage.sharepoint is not supported."
  });
});

test("negative sourceCoverage signalCount fails validation", async () => {
  const fixture = await loadFixtureObject();
  fixture.sourceCoverage = buildSourceCoverage({
    calendar: {
      status: "empty",
      signalCount: -1
    }
  });

  assert.throws(() => parseAgentProducedMicrosoft365SignalEnvelope(fixture), {
    message: "sourceCoverage.calendar.signalCount must be a non-negative number."
  });
});

test("rejects a payload when a required field is missing", async () => {
  const fixture = await loadFixtureObject();
  const brokenSignal = structuredClone(fixture.signals?.[0] as Record<string, unknown>);
  delete brokenSignal.title;
  fixture.signals = [brokenSignal];

  assert.throws(() => parseAgentProducedMicrosoft365SignalEnvelope(fixture), {
    message: "signals[0].title must be a non-empty string."
  });
});

test("rejects a payload when an enum field is invalid", async () => {
  const fixture = await loadFixtureObject();
  const brokenSignal = structuredClone(fixture.signals?.[0] as Record<string, unknown>);
  brokenSignal.attention = "urgent";
  fixture.signals = [brokenSignal];

  assert.throws(() => parseAgentProducedMicrosoft365SignalEnvelope(fixture), {
    message: "signals[0].attention must be one of: high, medium, low."
  });
});

test("prefers ignored local Agent payload when present", async () => {
  const fixture = await loadFixtureObject();
  fixture.tenantLabel = "Local override test tenant";
  const originalPayload = await snapshotLocalAgentPayload();

  await mkdir(dirname(LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH), { recursive: true });

  try {
    await writeFile(
      LOCAL_MICROSOFT_365_AGENT_PAYLOAD_PATH,
      JSON.stringify(fixture, null, 2),
      "utf8"
    );

    const { envelope, source } = await loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource();

    assert.equal(envelope.tenantLabel, "Local override test tenant");
    assert.equal(source, "local");
  } finally {
    await restoreLocalAgentPayload(originalPayload);
  }
});

test("returns fixture source when ignored local Agent payload is absent", async () => {
  const originalPayload = await snapshotLocalAgentPayload();

  try {
    await removeLocalAgentPayload();

    const result = await loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource();
    const envelope = await loadLocalAgentProducedMicrosoft365SignalEnvelope();

    assert.equal(result.source, "fixture");
    assert.ok(result.envelope.signals.length > 0);
    assert.deepEqual(envelope, result.envelope);
  } finally {
    await restoreLocalAgentPayload(originalPayload);
  }
});

test("executes the local microsoft signal intake workflow end to end", async () => {
  const result = await runMicrosoftSignalIntakeWorkflow();

  assert.ok(result.signalCount > 0);
  assert.equal(result.dailyBrief.supportNotes.length, 1);
  assert.equal(result.dailyBrief.sourceSignals.length, result.signalCount);
  assert.match(result.dailyBrief.supportNotes[0]?.body ?? "", /does not reuse connector tokens/i);
});

test("derives local agent handoff source-trust status", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);
  const status = deriveAgentHandoffSourceStatus({
    envelope,
    source: "local",
    now: "2026-05-28T09:15:00.000Z"
  });

  assert.equal(status.available, true);
  assert.equal(status.mode, "local");
  assert.equal(status.producer, "chatgpt_agent");
  assert.equal(status.connectorFamily, "microsoft_365");
  assert.equal(status.isFixture, false);
  assert.equal(status.isStale, false);
  assert.equal(status.ageLabel, "1 hr ago");
  assert.deepEqual(status.sourcesPresent, {
    outlook: true,
    calendar: true,
    teams: true
  });
  assert.deepEqual(status.signalCountsBySource, {
    outlook: 1,
    calendar: 1,
    teams: 1
  });
  assert.equal(status.hasExplicitSourceCoverage, true);
  assert.equal(status.sourceCoverageBySource.outlook.status, "included");
  assert.equal(status.sourceCoverageBySource.calendar.status, "included");
  assert.equal(status.sourceCoverageBySource.teams.status, "included");
  assert.equal(status.diagnosticCount, 0);
  assert.deepEqual(status.missingSources, []);
  assert.match(status.summary, /local handoff/i);
  assert.match(status.summary, /Outlook included/i);
  assert.match(status.summary, /Calendar included/i);
  assert.match(status.summary, /Teams included/i);
});

test("labels fixture agent handoff status as fallback not live data", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);
  const status = deriveAgentHandoffSourceStatus({
    envelope,
    source: "fixture",
    now: "2026-05-31T09:15:00.000Z"
  });

  assert.equal(status.mode, "fixture");
  assert.equal(status.isFixture, true);
  assert.match(status.summary, /fixture fallback/i);
  assert.match(status.summary, /not live data/i);
});

test("marks agent handoff stale when producedAt is older than threshold", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);
  const status = deriveAgentHandoffSourceStatus({
    envelope,
    source: "local",
    now: "2026-05-31T09:15:00.000Z"
  });

  assert.equal(status.isStale, true);
  assert.match(status.summary, /stale/i);
});

test("handles missing producedAt safely", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: null,
      sourceCoverage: buildSourceCoverage({
        outlook: {
          status: "included",
          signalCount: 1
        }
      }),
      signals: [buildSignal({ source: "outlook" })]
    },
    source: "local"
  });

  assert.equal(status.producedAt, null);
  assert.equal(status.ageLabel, null);
  assert.equal(status.isStale, false);
  assert.match(status.summary, /freshness unknown/i);
});

test("counts connector-health diagnostics and missing source families", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: "2026-05-31T08:00:00.000Z",
      sourceCoverage: buildSourceCoverage({
        outlook: {
          status: "included",
          checkedAt: "2026-05-31T07:58:00.000Z",
          signalCount: 1
        },
        calendar: {
          status: "empty",
          checkedAt: "2026-05-31T07:56:00.000Z",
          signalCount: 0,
          reason: "No relevant calendar items."
        },
        teams: {
          status: "permission_denied",
          checkedAt: "2026-05-31T07:55:00.000Z",
          signalCount: 0,
          reason: "Teams permission was denied."
        }
      }),
      signals: [
        buildSignal({
          source: "outlook",
          title: "Outlook connector review was unavailable",
          summary: "The Outlook connector could not be reviewed during this run."
        })
      ]
    },
    source: "local",
    now: "2026-05-31T09:00:00.000Z"
  });

  assert.deepEqual(status.signalCountsBySource, {
    outlook: 1,
    calendar: 0,
    teams: 0
  });
  assert.deepEqual(status.missingSources, []);
  assert.equal(status.diagnosticCount, 1);
  assert.equal(status.sourceCoverageBySource.calendar.status, "empty");
  assert.equal(status.sourceCoverageBySource.teams.status, "permission_denied");
  assert.match(status.summary, /Calendar checked, no relevant signals/i);
  assert.match(status.summary, /Teams permission denied/i);
  assert.match(status.summary, /1 connector-health diagnostic included/i);
});

test("explicit empty source is not treated as missing", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: "2026-05-31T08:00:00.000Z",
      sourceCoverage: buildSourceCoverage({
        outlook: {
          status: "included",
          signalCount: 1
        },
        calendar: {
          status: "empty",
          signalCount: 0
        },
        teams: {
          status: "skipped",
          signalCount: 0
        }
      }),
      signals: [buildSignal({ source: "outlook" })]
    },
    source: "local"
  });

  assert.deepEqual(status.missingSources, []);
  assert.equal(status.sourceCoverageBySource.calendar.status, "empty");
  assert.match(status.summary, /Calendar checked, no relevant signals/i);
});

test("explicit permission denied source is surfaced distinctly", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: "2026-05-31T08:00:00.000Z",
      sourceCoverage: buildSourceCoverage({
        teams: {
          status: "permission_denied",
          signalCount: 0,
          reason: "Graph scope was denied."
        }
      }),
      signals: []
    },
    source: "local"
  });

  assert.equal(status.sourceCoverageBySource.teams.status, "permission_denied");
  assert.match(status.summary, /Teams permission denied/i);
});

test("today source-trust status uses sourceCoverage when present", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: "2026-05-31T08:00:00.000Z",
      sourceCoverage: buildSourceCoverage({
        outlook: {
          status: "included",
          signalCount: 1
        },
        calendar: {
          status: "empty",
          signalCount: 0,
          reason: "No relevant meetings."
        },
        teams: {
          status: "skipped",
          signalCount: 0,
          reason: "Teams was intentionally skipped."
        }
      }),
      signals: [buildSignal({ source: "outlook" })]
    },
    source: "local"
  });

  assert.match(status.summary, /Calendar checked, no relevant signals/i);
  assert.match(status.summary, /Teams skipped/i);
});

test("absent sourceCoverage falls back to signal-presence inference", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: {
      producer: "chatgpt_agent",
      connectorFamily: "microsoft_365",
      producedAt: "2026-05-31T08:00:00.000Z",
      signals: [buildSignal({ source: "outlook" })]
    },
    source: "local"
  });

  assert.equal(status.hasExplicitSourceCoverage, false);
  assert.equal(status.sourceCoverageBySource.outlook.status, "included");
  assert.equal(status.sourceCoverageBySource.outlook.inferred, true);
  assert.equal(status.sourceCoverageBySource.calendar.status, "unknown");
  assert.deepEqual(status.missingSources, ["Calendar", "Teams"]);
  assert.match(status.summary, /Calendar coverage unknown/i);
});

test("fixture sourceCoverage aligns with fixture signal counts", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);

  const actualCounts = envelope.signals.reduce(
    (counts, signal) => {
      counts[signal.source] += 1;
      return counts;
    },
    { outlook: 0, calendar: 0, teams: 0 }
  );

  assert.equal(envelope.sourceCoverage?.outlook?.signalCount, actualCounts.outlook);
  assert.equal(envelope.sourceCoverage?.calendar?.signalCount, actualCounts.calendar);
  assert.equal(envelope.sourceCoverage?.teams?.signalCount, actualCounts.teams);
});

test("handles missing agent handoff safely", () => {
  const status = deriveAgentHandoffSourceStatus({
    envelope: null,
    source: "missing"
  });

  assert.equal(status.available, false);
  assert.equal(status.mode, "missing");
  assert.equal(status.summary, "Agent Microsoft 365 brief · missing");
});

test("formats microsoft source mode labels", () => {
  assert.equal(getMicrosoftSourceModeLabel("agent_handoff"), "Agent handoff");
  assert.equal(getMicrosoftSourceModeLabel("graph_oauth"), "Graph OAuth");
  assert.equal(getMicrosoftSourceModeLabel("mixed"), "Mixed");
});

test("classifies unavailable connector status signals as connector health", () => {
  const signal = buildSignal({
    title: "Teams connector was unavailable",
    summary: "The Teams connector could not be reviewed during this dry run."
  });

  assert.equal(isConnectorHealthSignal(signal), true);
});

test("does not classify ordinary business status updates as connector health", () => {
  const signal = buildSignal({
    title: "Ops team marked migration on track",
    summary: "Delivery remains on schedule with no new risks.",
    sourceLabel: "Operations"
  });

  assert.equal(isConnectorHealthSignal(signal), false);
});

test("strips markdown link urls from source-label display text", () => {
  const display = sanitizeDisplayText(
    "Re: Memo · [Open](https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1)"
  );

  assert.equal(display, "Re: Memo");
});

test("removes raw outlook urls from display text", () => {
  const display = sanitizeDisplayText(
    "Outlook thread · https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1"
  );

  assert.equal(display, "Outlook thread");
});

test("preserves ordinary display labels", () => {
  assert.equal(sanitizeDisplayText("Customer expansion review"), "Customer expansion review");
});

test("repairs malformed markdown-style action text for display", () => {
  const display = sanitizeDisplayText(
    "Prepare](https://outlook.office365.com/owa/?ItemID=abc123) the Monday readout."
  );

  assert.equal(display, "Prepare the Monday readout.");
  assert.equal(
    stripMarkdownLinks("Review [brief](https://outlook.office365.com/owa/?ItemID=abc123) now."),
    "Review brief now."
  );
});

test("extracts a usable source href from malformed outlook url strings", () => {
  const href = getDisplaySourceHref(
    "[https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1&viewmodel=ReadMessageItem"
  );

  assert.equal(
    href,
    "https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1&viewmodel=ReadMessageItem"
  );
});

test("maps signal attention to task priority", () => {
  assert.equal(mapSignalAttentionToTaskPriority("high"), "high");
  assert.equal(mapSignalAttentionToTaskPriority("medium"), "medium");
  assert.equal(mapSignalAttentionToTaskPriority("low"), "low");
});

test("builds a task capture draft from a signal", () => {
  const signal = buildSignal({
    attention: "high",
    source: "outlook",
    title: "Harbinger CEO discussion needs next-step direction",
    summary:
      "Kim Snyder and Rajeev Oak shared context from the Harbinger CEO discussion, including real estate needs and generator opportunity angles.",
    sourceLabel: "Harbinger Generator discussion with CEO",
    occurredAt: "2026-05-29T06:46:07Z",
    sourceUrl:
      "[https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1&viewmodel=ReadMessageItem",
    actionRequest:
      "Decide](https://outlook.office365.com/owa/?ItemID=abc123) whether and how to engage Harbinger on real estate opportunities."
  });

  const draft = buildTaskCaptureDraftFromSignal(signal);

  assert.equal(draft.pattern, "task");
  assert.equal(draft.task.description, "Harbinger CEO discussion needs next-step direction");
  assert.equal(
    draft.task.nextStep,
    "Decide whether and how to engage Harbinger on real estate opportunities."
  );
  assert.match(draft.task.desiredOutcome, /Harbinger CEO discussion/i);
  assert.equal(draft.task.priority, "high");
  assert.equal(draft.task.categoryId, null);
  assert.equal(draft.sourceContext.entries[0]?.value, "Outlook");
  assert.equal(
    draft.sourceContext.entries.find((entry) => entry.label === "Source URL")?.href,
    "https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1&viewmodel=ReadMessageItem"
  );
});

test("builds a note capture draft from a signal", () => {
  const signal = buildSignal({
    source: "calendar",
    title: "Board prep meeting holds a narrow decision window",
    summary:
      "The afternoon calendar block makes the hiring-brief decision time-sensitive because materials lock before the meeting starts.",
    sourceLabel: "Board prep meeting · [Open](https://outlook.office365.com/owa/?ItemID=abc123)",
    occurredAt: "2026-05-29T18:00:00Z",
    sourceUrl:
      "[https://outlook.office365.com/owa/?ItemID=abc123&exvsurl=1&viewmodel=ReadMessageItem",
    actionRequest:
      "Use the board prep meeting as the cutoff for confirming the revised brief."
  });

  const draft = buildNoteCaptureDraftFromSignal(signal);

  assert.equal(draft.pattern, "note");
  assert.equal(draft.note.title, "Board prep meeting holds a narrow decision window");
  assert.match(draft.note.body, /Action request:/);
  assert.match(draft.note.body, /Source context:/);
  assert.match(draft.note.body, /Source: Calendar/);
  assert.doesNotMatch(draft.note.body, /outlook\.office365\.com\/owa\/\?ItemID=.*Action request/i);
  assert.match(draft.note.body, /Source URL: https:\/\/outlook\.office365\.com\/owa\/\?ItemID=abc123/);
});
