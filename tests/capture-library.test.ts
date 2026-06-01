import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutiveCaptureMetadata } from "../lib/blackhawk-capture-model";
import {
  mergeExecutiveCaptureMetadata,
  resolveLibraryItemEditorMode
} from "../lib/library-executive-edit";

test("resolves executive editor modes from explicit capture types", () => {
  assert.equal(
    resolveLibraryItemEditorMode({
      type: "note",
      captureType: "decision",
      executiveWorkType: "decision"
    }),
    "decision"
  );

  assert.equal(
    resolveLibraryItemEditorMode({
      type: "task",
      captureType: "waiting_on",
      executiveWorkType: "delegation"
    }),
    "waiting_on"
  );
});

test("falls back to executive work type when capture type metadata is missing", () => {
  assert.equal(
    resolveLibraryItemEditorMode({
      type: "note",
      captureType: null,
      executiveWorkType: "meeting"
    }),
    "meeting_note"
  );

  assert.equal(
    resolveLibraryItemEditorMode({
      type: "task",
      captureType: null,
      executiveWorkType: "delegation"
    }),
    "waiting_on"
  );
});

test("decision metadata updates preserve unknown keys and capture type", () => {
  const existing = {
    captureType: "decision",
    decisionQuestion: "Should we approve the board-prep direction?",
    status: "needs_review",
    sourceThreadId: "thread-7"
  } as ExecutiveCaptureMetadata & { sourceThreadId: string };

  const merged = mergeExecutiveCaptureMetadata(existing, {
    captureType: "decision",
    recommendation: "Approve the narrowed direction.",
    status: null
  }) as ExecutiveCaptureMetadata & { sourceThreadId?: string };

  assert.equal(merged.captureType, "decision");
  assert.equal(merged.decisionQuestion, "Should we approve the board-prep direction?");
  assert.equal(merged.recommendation, "Approve the narrowed direction.");
  assert.equal(merged.status, null);
  assert.equal(merged.sourceThreadId, "thread-7");
});

test("waiting-on metadata updates preserve task-compatible context", () => {
  const existing = {
    captureType: "waiting_on",
    waitingOn: "Finance",
    delegatedTo: "Will",
    relatedOpportunity: "Harbinger diligence",
    untouchedKey: "preserve-me"
  } as ExecutiveCaptureMetadata & { untouchedKey: string };

  const merged = mergeExecutiveCaptureMetadata(existing, {
    captureType: "waiting_on",
    expectedOutcome: "Receive the updated numbers.",
    followUpAt: "2026-06-02T16:00:00.000Z",
    delegatedTo: "Chief of Staff"
  }) as ExecutiveCaptureMetadata & { untouchedKey?: string };

  assert.equal(merged.captureType, "waiting_on");
  assert.equal(merged.waitingOn, "Finance");
  assert.equal(merged.expectedOutcome, "Receive the updated numbers.");
  assert.equal(merged.delegatedTo, "Chief of Staff");
  assert.equal(merged.relatedOpportunity, "Harbinger diligence");
  assert.equal(merged.untouchedKey, "preserve-me");
});

test("meeting-note metadata updates preserve existing related context", () => {
  const existing = {
    captureType: "meeting_note",
    meetingTitle: "Board prep review",
    relatedCompany: "Harbinger",
    attendees: "Will, Amelia"
  } satisfies ExecutiveCaptureMetadata;

  const merged = mergeExecutiveCaptureMetadata(existing, {
    captureType: "meeting_note",
    decisions: "Narrow the board packet.",
    followUps: "Send the revised memo.",
    waitingOnItems: "Finance numbers"
  });

  assert.equal(merged.captureType, "meeting_note");
  assert.equal(merged.meetingTitle, "Board prep review");
  assert.equal(merged.relatedCompany, "Harbinger");
  assert.equal(merged.decisions, "Narrow the board packet.");
  assert.equal(merged.followUps, "Send the revised memo.");
  assert.equal(merged.waitingOnItems, "Finance numbers");
});
