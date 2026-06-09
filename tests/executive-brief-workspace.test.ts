import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ExecutiveBriefWorkspace } from "../components/brief/executive-brief-workspace";
import type { ExecutiveBriefPageData } from "../lib/brief/load-executive-brief-page-data";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function renderWorkspaceText(data: ExecutiveBriefPageData) {
  return renderToStaticMarkup(ExecutiveBriefWorkspace({ data })).replace(/<[^>]*>/g, " ");
}

function buildData(sourceUrl: string | null): ExecutiveBriefPageData {
  return {
    latestSnapshot: {
      id: "snapshot-1",
      subject: "BLACKHAWK_BRIEF_BUNDLE 7 AM",
      slot: "7 AM",
      generatedAt: "2026-06-08T14:00:00.000Z",
      displayDate: "June 8, 2026",
      rawEmailBody: "raw",
      humanBrief: "Latest human summary.",
      jsonBundle: null,
      structuredBrief: {
        commandSummary: ["Keep the board approval path moving."],
        topMoves: [
          {
            id: "email-1",
            title: "Reply to Maya",
            summary: "Maya needs the approval answer.",
            source: "Outlook",
            sourceLane: "email",
            sourceLabel: "Approval thread",
            sourceUrl,
            senderName: sourceUrl ? "Maya Finance" : null,
            senderEmail: sourceUrl ? "maya@example.com" : null,
            priority: "high",
            recommendedAction: "Reply",
            dueAt: null,
            attendees: []
          }
        ],
        decisionsNeeded: [],
        meetingPrep: [
          {
            id: "meeting-1",
            title: "Board prep",
            summary: "Prepare the approval path.",
            source: "Calendar",
            sourceLane: "calendar_meetings",
            calendarEventId: "event-1",
            calendarSourceSystemId: "outlook",
            priority: "medium",
            recommendedAction: "Prepare",
            dueAt: null,
            startAt: "2026-06-08T17:00:00.000Z",
            attendees: ["Will O'Donnell", "Maya Finance"]
          }
        ],
        carryForward: [],
        taskCandidates: []
      },
      contractVersion: "executive_brief.v1",
      validationWarnings: [],
      sourceMessageId: "message-1",
      createdAt: "2026-06-08T14:01:00.000Z"
    },
    dismissedTaskCandidateIds: [],
    meetingRecordStatuses: {},
    slots: [],
    emptyState: {
      title: "No processed Blackhawk Executive Brief exists yet.",
      detail: "Waiting."
    }
  };
}

test("Executive Brief summary renders below source lanes and above Agent Email Intake by default closed", () => {
  const html = renderToStaticMarkup(ExecutiveBriefWorkspace({ data: buildData("https://outlook.example/message-1") }));
  const text = html.replace(/<[^>]*>/g, " ");
  const emailIndex = text.indexOf("Email");
  const calendarIndex = text.indexOf("Calendar / Meetings");
  const summaryIndex = text.indexOf("Executive Brief Summary");
  const intakeIndex = text.indexOf("Agent-email intake");
  const summaryDetailsMatch = html.match(/<details\b[^>]*data-brief-section="executive-brief-summary"[^>]*>/);

  assert.ok(emailIndex >= 0);
  assert.ok(calendarIndex > emailIndex);
  assert.ok(summaryIndex > calendarIndex);
  assert.ok(intakeIndex > summaryIndex);
  assert.ok(summaryDetailsMatch);
  assert.doesNotMatch(summaryDetailsMatch[0], /\sopen(=|\s|>)/);
});

test("Executive Brief cards render Open Source only for sourceUrl and Open in Brief as fallback", () => {
  const linkedHtml = renderToStaticMarkup(ExecutiveBriefWorkspace({ data: buildData("https://outlook.example/message-1") }));
  const linkedText = renderWorkspaceText(buildData("https://outlook.example/message-1"));

  assert.match(linkedHtml, /href="https:\/\/outlook\.example\/message-1"[^>]*>\s*Open Source\s*<\/a>/);
  assert.doesNotMatch(linkedText, /Open in Brief/);

  const fallbackText = renderWorkspaceText(buildData(null));

  assert.doesNotMatch(fallbackText, /Open Source/);
  assert.match(fallbackText, /Open in Brief/);
});

test("Executive Brief source lanes collapse duplicate cards from the same original source", () => {
  const data = buildData("https://outlook.example/message-1");
  const structuredBrief = data.latestSnapshot!.structuredBrief!;
  const duplicateSource = "https://outlook.example/message-1";

  data.latestSnapshot!.structuredBrief = {
    ...structuredBrief,
    decisionsNeeded: [
      {
        id: "decision-email-1",
        title: "Decide what the BP Planning Calendar milestones require",
        summary: null,
        source: "Outlook",
        sourceLane: "email",
        sourceLabel: "Approval thread",
        sourceUrl: duplicateSource,
        senderName: "Maya Finance",
        senderEmail: "maya@example.com",
        priority: null,
        recommendedAction: null,
        dueAt: null,
        attendees: []
      }
    ],
    taskCandidates: [
      {
        id: "task-email-1",
        title: "Confirm BP Planning Calendar deliverables",
        summary: null,
        source: "Outlook",
        sourceLane: "email",
        sourceLabel: "Approval thread",
        sourceUrl: duplicateSource,
        senderName: "Maya Finance",
        senderEmail: "maya@example.com",
        priority: "high",
        recommendedAction: null,
        dueAt: null,
        attendees: []
      }
    ]
  };

  const text = renderWorkspaceText(data);

  assert.equal(text.split("Reply to Maya").length - 1, 1);
  assert.equal(text.split("Decide what the BP Planning Calendar milestones require").length - 1, 0);
  assert.equal(text.split("Confirm BP Planning Calendar deliverables").length - 1, 0);
});

test("Executive Brief meeting cards render saved research summary and adapter limits", () => {
  const data = buildData("https://outlook.example/message-1");
  data.meetingRecordStatuses = {
    "event-1": {
      id: "meeting-record-1",
      calendarEventId: "event-1",
      researchStatus: "researched",
      researchCompletedAt: "2026-06-08T21:00:00.000Z",
      researchSummary: {
        meetingRecordId: "meeting-record-1",
        generatedAt: "2026-06-08T21:00:00.000Z",
        sourceCoverage: [
          {
            sourceType: "calendar_event_details",
            used: true,
            itemCount: 1,
            internalOnlyReason: null
          },
          {
            sourceType: "outlook",
            used: false,
            itemCount: 0,
            internalOnlyReason: "Meeting-specific Outlook source adapter is not available in this phase."
          }
        ],
        calendarEventDetails: null,
        highLevelContext: "Calendar-backed context is saved for this meeting.",
        recentRelevantActivity: [],
        situationRead: null,
        keyPriorities: [
          {
            title: "Confirm prep owner",
            reason: "The meeting needs a named owner.",
            sourceRefs: []
          }
        ],
        suggestedQuestions: [],
        relevantLinks: [],
        taskCandidates: []
      },
      transcriptStatus: "none",
      taskCandidateCount: 0,
      taskCandidates: [],
      obsidianExportStatus: "not_exported"
    }
  };

  const text = renderWorkspaceText(data);

  assert.match(text, /Research Context/);
  assert.match(text, /Calendar-backed context is saved for this meeting/);
  assert.match(text, /Confirm prep owner: The meeting needs a named owner/);
  assert.match(text, /Used sources: Calendar Event Details \(1\)/);
  assert.match(text, /Unavailable adapters: Outlook: Meeting-specific Outlook source adapter is not available in this phase/);
});
