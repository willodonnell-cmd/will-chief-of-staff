import test from "node:test";
import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";

import {
  LOCAL_MICROSOFT_365_FIXTURE_URL,
  parseAgentProducedMicrosoft365SignalEnvelope
} from "../lib/microsoft-signal-intake.ts";
import { adaptMicrosoft365SignalsToPrototypeDailyBrief } from "../lib/prototype-daily-brief.ts";
import { runMicrosoftSignalIntakeWorkflow } from "../trigger/microsoft-signal-intake.ts";

async function loadFixtureObject() {
  const contents = await readFile(LOCAL_MICROSOFT_365_FIXTURE_URL, "utf8");
  return JSON.parse(contents) as Record<string, unknown>;
}

test("parses the local ChatGPT Agent Microsoft 365 payload", async () => {
  const fixture = await loadFixtureObject();
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(fixture);
  const dailyBrief = adaptMicrosoft365SignalsToPrototypeDailyBrief(envelope);

  assert.equal(envelope.tenantLabel, "Will O'Donnell Microsoft 365");
  assert.equal(envelope.signals.length, 3);
  assert.equal(dailyBrief.brief.highFocusTitle, "Board packet scope changed after hiring-brief revision");
  assert.deepEqual(
    dailyBrief.glanceItems.map((item) => item.label),
    ["Needs decision", "Quietly on track", "Protected"]
  );
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

  assert.equal(result.signalCount, 3);
  assert.equal(result.dailyBrief.supportNotes.length, 1);
  assert.equal(result.dailyBrief.sourceSignals[0]?.source, "outlook");
  assert.match(result.dailyBrief.supportNotes[0]?.body ?? "", /does not reuse connector tokens/i);
});
