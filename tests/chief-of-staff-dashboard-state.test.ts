import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDashboardAction,
  createPreparedBrief,
  DASHBOARD_SECTION_ORDER,
  deriveDashboardView,
  type ChiefOfStaffDashboardData
} from "../src/chief-of-staff-dashboard-state";

const baseData: ChiefOfStaffDashboardData = {
  decisionsNeeded: [
    {
      id: "decision-1",
      title: "Decision one",
      type: "decision",
      status: "Priority",
      priority: "P1",
      confidence: "High",
      source: "document",
      sourceAnchor: "anchor",
      createdAt: "2026-05-27T08:00:00-07:00",
      updatedAt: "2026-05-27T08:00:00-07:00",
      reason: "reason",
      description: "description",
      recommendedAction: "act",
      sourceSummary: "summary",
      options: ["A", "B"]
    }
  ],
  peopleWaitingOnWill: [
    {
      id: "waiting-on-will-1",
      title: "Jordan needs a reply",
      type: "waiting_on",
      status: "Waiting On",
      priority: "P1",
      confidence: "High",
      source: "email",
      sourceAnchor: "anchor",
      createdAt: "2026-05-27T08:00:00-07:00",
      updatedAt: "2026-05-27T08:00:00-07:00",
      reason: "reason",
      description: "description",
      recommendedAction: "reply",
      sourceSummary: "summary",
      counterparty: "Jordan",
      expectedOutcome: "Reply"
    }
  ],
  priorityInboxItems: [
    {
      id: "priority-1",
      title: "Priority one",
      type: "priority",
      status: "Today",
      priority: "P1",
      confidence: "High",
      source: "email",
      sourceAnchor: "anchor",
      createdAt: "2026-05-27T08:00:00-07:00",
      updatedAt: "2026-05-27T08:00:00-07:00",
      reason: "reason",
      description: "description",
      recommendedAction: "act",
      sourceSummary: "summary"
    }
  ],
  preparedBriefs: [
    {
      id: "brief-1",
      meetingId: "meeting-1",
      meetingTitle: "Prepared meeting",
      startsAt: "2026-05-28T09:00:00-07:00",
      level: "standard",
      confidence: "High",
      source: "calendar",
      sourceAnchor: "anchor",
      whyShown: "why",
      sourceSummary: "summary",
      recommendedAction: "Open it",
      sections: [{ label: "Objective", body: "body" }]
    }
  ],
  prepCandidates: [
    {
      id: "candidate-1",
      meetingId: "meeting-2",
      meetingTitle: "Candidate meeting",
      startsAt: "2026-05-29T09:00:00-07:00",
      confidence: "Medium",
      source: "calendar",
      sourceAnchor: "anchor",
      whyShown: "why",
      sourceSummary: "summary",
      availableSources: ["Calendar"],
      suggestedPrepLevel: "light",
      recommendedAction: "light",
      unusualTrigger: "trigger"
    }
  ],
  strategicFyis: [
    {
      id: "fyi-1",
      title: "FYI one",
      type: "fyi",
      status: "Priority",
      priority: "P3",
      confidence: "Medium",
      source: "document",
      sourceAnchor: "anchor",
      createdAt: "2026-05-27T08:00:00-07:00",
      updatedAt: "2026-05-27T08:00:00-07:00",
      reason: "reason",
      description: "description",
      recommendedAction: "read",
      sourceSummary: "summary"
    }
  ],
  followUpsOpenLoops: [
    {
      id: "follow-up-1",
      title: "Follow up",
      type: "follow_up",
      status: "Priority",
      priority: "P2",
      confidence: "Medium",
      source: "email",
      sourceAnchor: "anchor",
      createdAt: "2026-05-27T08:00:00-07:00",
      updatedAt: "2026-05-27T08:00:00-07:00",
      reason: "reason",
      description: "description",
      recommendedAction: "act",
      sourceSummary: "summary",
      counterparty: "Jordan",
      expectedOutcome: "Reply"
    }
  ],
  recentlyCaptured: [
    {
      id: "captured-1",
      title: "Recent capture",
      type: "captured",
      status: "Priority",
      priority: "P2",
      confidence: "Medium",
      source: "manual-capture",
      sourceAnchor: "anchor",
      createdAt: "2026-05-27T08:00:00-07:00",
      updatedAt: "2026-05-27T08:00:00-07:00",
      reason: "reason",
      description: "description",
      recommendedAction: "act",
      sourceSummary: "summary"
    }
  ],
  lowValueNoiseFiltered: {
    count: 2,
    label: "2 low-value items filtered."
  },
  emptyStates: {
    decisionsNeeded: "No decisions.",
    peopleWaitingOnWill: "Nobody waiting.",
    priorityInboxItems: "No inbox items.",
    meetingPrep: "No meeting prep.",
    strategicFyis: "No fyis.",
    followUpsOpenLoops: "No follow-ups.",
    recentlyCaptured: "Nothing recent."
  },
  links: {
    brainHref: "/library",
    vaultSearchHref: "/library?search=",
    investmentAgentHref: "/investment-agent"
  }
};

test("dashboard section order stays exact", () => {
  assert.deepEqual(DASHBOARD_SECTION_ORDER, [
    "decisions_needed",
    "people_waiting_on_will",
    "priority_inbox",
    "meeting_prep",
    "strategic_fyis",
    "follow_ups_open_loops",
    "recently_captured",
    "quick_capture",
    "links"
  ]);
});

test("prepared briefs stay above prep candidates and candidate promotion creates a brief", () => {
  const state = applyDashboardAction({}, { type: "prepare_candidate", id: "candidate-1", level: "deep" });
  const view = deriveDashboardView(baseData, state, "2026-05-27T10:00:00-07:00");

  assert.equal(view.preparedBriefs.length, 2);
  assert.equal(view.prepCandidates.length, 0);
  assert.equal(view.preparedBriefs[0]?.id, "brief-1");
  assert.equal(view.preparedBriefs[1]?.meetingTitle, "Candidate meeting");
  assert.equal(view.preparedBriefs[1]?.level, "deep");
});

test("done and dismiss remove items from active visibility", () => {
  const afterDone = applyDashboardAction({}, { type: "done", id: "priority-1" });
  const afterDismiss = applyDashboardAction(afterDone, { type: "dismiss", id: "decision-1" });
  const view = deriveDashboardView(baseData, afterDismiss, "2026-05-27T10:00:00-07:00");

  assert.equal(view.priorityInboxItems.length, 0);
  assert.equal(view.decisionsNeeded.length, 0);
});

test("snooze hides items until the selected date", () => {
  const state = applyDashboardAction({}, { type: "snooze", id: "follow-up-1", until: "2026-05-30T09:00:00-07:00" });
  const view = deriveDashboardView(baseData, state, "2026-05-27T10:00:00-07:00");

  assert.equal(view.followUpsOpenLoops.length, 0);
});

test("moving an item to Waiting On requires counterparty and expected outcome", () => {
  const state = applyDashboardAction({}, {
    type: "move_to_waiting_on",
    id: "follow-up-1",
    counterparty: "Jordan Lee",
    expectedOutcome: "Final candidate notes arrive."
  });
  const view = deriveDashboardView(baseData, state, "2026-05-27T10:00:00-07:00");

  const movedItem = view.peopleWaitingOnWill.find((item) => item.id === "follow-up-1");
  assert.equal(view.followUpsOpenLoops.length, 0);
  assert.equal(movedItem?.counterparty, "Jordan Lee");
  assert.equal(movedItem?.expectedOutcome, "Final candidate notes arrive.");
});

test("prepared brief templates stay fixed by prep level", () => {
  const brief = createPreparedBrief(baseData.prepCandidates[0]!, "standard");
  const sectionLabels = brief.sections.map((section) => section.label);

  assert.deepEqual(sectionLabels, [
    "Objective",
    "Attendees",
    "Recent context",
    "Talking points",
    "Sources",
    "Likely decisions",
    "Commitments and open loops",
    "Related sources"
  ]);
});
