import assert from "node:assert/strict";
import test from "node:test";

import { routeAgentSignal } from "../lib/agent-signals/routing";
import type { ChiefOfStaffSignal } from "../lib/chief-of-staff-signal";

function buildSignal(overrides: Partial<ChiefOfStaffSignal> = {}): ChiefOfStaffSignal {
  return {
    id: "signal-1",
    source: "outlook",
    signalType: "follow_up",
    attention: "high",
    title: "Default signal title",
    summary: "Default signal summary",
    whyItMatters: "Default why-it-matters context.",
    owner: "Will O'Donnell",
    sourceLabel: "Outlook",
    sourceReference: null,
    occurredAt: "2026-06-04T12:00:00.000Z",
    dueAt: null,
    sourceUrl: null,
    category: "general",
    actionRequest: "Default action request.",
    participants: ["Will O'Donnell"],
    protectedContext: false,
    metadata: null,
    ...overrides
  };
}

test("direct Will ask routes to Priority Inbox", () => {
  const result = routeAgentSignal(
    buildSignal({
      title: "Follow up with Will on the board packet blocker",
      summary: "The sender is waiting on Will to respond today.",
      whyItMatters: "The decision is blocking a high-priority workstream.",
      actionRequest: "Will should reply and unblock the next step."
    })
  );

  assert.equal(result.outcome, "priority_inbox");
});

test("strategic FYI can still route to Priority Inbox when sufficiently important", () => {
  const result = routeAgentSignal(
    buildSignal({
      signalType: "status",
      attention: "medium",
      title: "Strategic partner pricing changed for the Blackhawk rollout",
      summary: "Updated pricing materially affects launch timing and partner economics.",
      whyItMatters: "Will needs this in foreground attention even if the next step is not due immediately.",
      actionRequest: null
    })
  );

  assert.equal(result.outcome, "priority_inbox");
});

test("Investment Committee signals route out of Priority Inbox", () => {
  const result = routeAgentSignal(
    buildSignal({
      signalType: "status",
      attention: "medium",
      title: "IC memo package is ready for review",
      summary: "Susan Pi circulated the Investment Committee package.",
      whyItMatters: "This belongs in the Investment Committee workflow.",
      owner: "Susan Pi",
      sourceLabel: "Investment Committee",
      category: "IC",
      actionRequest: null,
      participants: ["Susan Pi", "Will O'Donnell"]
    })
  );

  assert.equal(result.outcome, "investment_committee");
});

test("newsletter and promotional noise is suppressed", () => {
  const result = routeAgentSignal(
    buildSignal({
      signalType: "status",
      attention: "low",
      title: "Webinar invite and recruiting newsletter",
      summary: "Cold sales outreach plus recruiting updates with no action needed.",
      whyItMatters: "There is no executive action here.",
      owner: "Marketing Automation",
      sourceLabel: "Newsletter",
      actionRequest: null
    })
  );

  assert.equal(result.outcome, "suppressed_low_signal");
});

test("low-signal Teams chatter is suppressed", () => {
  const result = routeAgentSignal(
    buildSignal({
      source: "teams",
      signalType: "status",
      attention: "low",
      title: "Quick thanks from the team",
      summary: "Just sharing a quick thanks and no action items.",
      whyItMatters: "Routine chatter should not pollute Priority Inbox.",
      sourceLabel: "Teams chat",
      actionRequest: null
    })
  );

  assert.equal(result.outcome, "suppressed_low_signal");
});

test("connector health diagnostics are suppressed from Priority Inbox", () => {
  const result = routeAgentSignal(
    buildSignal({
      source: "teams",
      signalType: "status",
      attention: "low",
      title: "Teams connector was unavailable",
      summary: "The Teams connector could not be reviewed during this dry run.",
      whyItMatters: "Connector health should stay operational, not executive.",
      sourceLabel: "Teams diagnostics",
      actionRequest: null
    })
  );

  assert.equal(result.outcome, "suppressed_low_signal");
});
