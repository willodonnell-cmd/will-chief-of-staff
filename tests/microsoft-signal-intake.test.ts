import test from "node:test";
import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";

import {
  LOCAL_MICROSOFT_365_FIXTURE_URL,
  parseAgentProducedMicrosoft365SignalEnvelope
} from "../lib/microsoft-signal-intake";
import {
  CHIEF_OF_STAFF_SIGNAL_ATTENTION,
  CHIEF_OF_STAFF_SIGNAL_SOURCES,
  CHIEF_OF_STAFF_SIGNAL_TYPES
} from "../lib/chief-of-staff-signal";
import { adaptMicrosoft365SignalsToPrototypeDailyBrief } from "../lib/prototype-daily-brief";
import { runMicrosoftSignalIntakeWorkflow } from "../trigger/microsoft-signal-intake";

async function loadFixtureObject() {
  const contents = await readFile(LOCAL_MICROSOFT_365_FIXTURE_URL, "utf8");
  return JSON.parse(contents) as { signals?: unknown[]; [key: string]: unknown };
}

test("parses the local ChatGPT Agent Microsoft 365 payload", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);
  const dailyBrief = adaptMicrosoft365SignalsToPrototypeDailyBrief(envelope);

  assert.equal(envelope.producer, "chatgpt_agent");
  assert.equal(envelope.connectorFamily, "microsoft_365");
  assert.equal(typeof envelope.tenantLabel, "string");
  assert.notEqual(envelope.tenantLabel.trim(), "");
  assert.ok(envelope.signals.length > 0);
  assert.ok(
    envelope.signals.some((signal) => CHIEF_OF_STAFF_SIGNAL_SOURCES.includes(signal.source))
  );

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

test("executes the local microsoft signal intake workflow end to end", async () => {
  const result = await runMicrosoftSignalIntakeWorkflow();

  assert.ok(result.signalCount > 0);
  assert.equal(result.dailyBrief.supportNotes.length, 1);
  assert.equal(result.dailyBrief.sourceSignals.length, result.signalCount);
  assert.match(result.dailyBrief.supportNotes[0]?.body ?? "", /does not reuse connector tokens/i);
});
