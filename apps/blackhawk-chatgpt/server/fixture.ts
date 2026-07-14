export const previewBrief = {
  mode: "preview" as const,
  brief: {
    contractVersion: "blackhawk.live-brief.v1",
    briefId: "preview-brief-1",
    generatedAt: "2026-07-13T16:05:00.000Z",
    previousBriefId: "preview-brief-0",
    refresh: {
      trigger: "open",
      status: "succeeded",
      startedAt: "2026-07-13T16:04:30.000Z",
      completedAt: "2026-07-13T16:05:00.000Z",
      materialChangeCount: 2
    },
    sourceCoverage: {
      outlook: { status: "available", checkedAt: "2026-07-13T16:05:00.000Z", warning: null },
      calendar: { status: "available", checkedAt: "2026-07-13T16:05:00.000Z", warning: null },
      teams: { status: "partial", checkedAt: "2026-07-13T16:05:00.000Z", warning: "Teams coverage is partial in this preview." }
    },
    sections: {
      topActions: {
        additionalItemCount: 0,
        items: [
          {
            id: "preview-action-1",
            canonicalIssueKey: "board-prep-direction",
            kind: "top_action",
            headline: "Approve the board-prep direction",
            explanation: "Your decision will unblock the team before tomorrow's preparation session.",
            priority: "critical",
            confidence: "high",
            change: "new",
            rank: 1,
            context: "The working team has converged on one direction and is waiting before finalizing the materials.",
            whyNow: "The preparation session begins tomorrow morning.",
            recommendedNextMove: "Review the recommendation and approve or revise the direction.",
            relatedPeople: ["Preview: Amelia Hart"],
            relatedCompanies: [],
            relatedTopic: "Board preparation",
            dueAt: "2026-07-14T16:00:00.000Z",
            meetingStartAt: null,
            waitingOn: null,
            expectedTrigger: null,
            evidence: [
              { source: "outlook", id: "preview-email-1", label: "Preview email · Board prep recommendation", url: null, occurredAt: "2026-07-13T15:45:00.000Z" },
              { source: "teams", id: "preview-teams-1", label: "Preview Teams thread · Materials status", url: null, occurredAt: "2026-07-13T15:52:00.000Z" }
            ],
            sourceConflict: null,
            allowedActions: ["accept_as_task", "dismiss", "draft_response", "run_deeper_research", "adjust"]
          },
          {
            id: "preview-action-2",
            canonicalIssueKey: "partner-follow-up",
            kind: "top_action",
            headline: "Resolve the partner follow-up",
            explanation: "A concise response today will preserve momentum on an important relationship.",
            priority: "high",
            confidence: "high",
            change: "reranked",
            rank: 2,
            context: "The latest note narrows the open question to one commercial point.",
            whyNow: "The counterparty asked for a response today.",
            recommendedNextMove: "Draft a direct response addressing the remaining point.",
            relatedPeople: ["Preview: Jordan Lee"],
            relatedCompanies: ["Preview Company"],
            relatedTopic: "Strategic partnership",
            dueAt: "2026-07-13T23:00:00.000Z",
            meetingStartAt: null,
            waitingOn: null,
            expectedTrigger: null,
            evidence: [{ source: "outlook", id: "preview-email-2", label: "Preview email · Partner follow-up", url: null, occurredAt: "2026-07-13T14:20:00.000Z" }],
            sourceConflict: null,
            allowedActions: ["accept_as_task", "dismiss", "draft_response", "run_deeper_research", "adjust"]
          }
        ]
      },
      decisionsNeeded: {
        additionalItemCount: 0,
        items: [{
          id: "preview-decision-1",
          canonicalIssueKey: "budget-sequencing",
          kind: "decision",
          headline: "Choose the budget sequencing",
          explanation: "The team needs one sequencing choice before it can finalize the plan.",
          priority: "high",
          confidence: "medium",
          change: "changed",
          rank: null,
          context: "Two feasible sequences remain, with different timing tradeoffs.",
          whyNow: "Planning closes this week.",
          recommendedNextMove: "Review the two alternatives and select one.",
          relatedPeople: ["Preview: Finance lead"], relatedCompanies: [], relatedTopic: "Annual plan",
          dueAt: "2026-07-15T19:00:00.000Z", meetingStartAt: null, waitingOn: null, expectedTrigger: null,
          evidence: [{ source: "teams", id: "preview-teams-2", label: "Preview Teams thread · Sequencing options", url: null, occurredAt: "2026-07-13T13:30:00.000Z" }],
          sourceConflict: null,
          allowedActions: ["accept_as_task", "dismiss", "draft_response", "run_deeper_research", "adjust"]
        }]
      },
      meetingPrep: {
        additionalItemCount: 1,
        items: [{
          id: "preview-meeting-1", canonicalIssueKey: "operating-review", kind: "meeting_prep",
          headline: "Operating review", explanation: "Tomorrow's meeting requires a decision on the two open operating issues.",
          priority: "high", confidence: "high", change: "unchanged", rank: null,
          context: "The agenda centers on performance, the open dependency, and the decision required from you.",
          whyNow: "The meeting starts within 24 hours.", recommendedNextMove: "Review the open issues and desired meeting outcome.",
          relatedPeople: ["Preview: Operating team"], relatedCompanies: [], relatedTopic: "Operations",
          dueAt: null, meetingStartAt: "2026-07-14T17:00:00.000Z", waitingOn: null, expectedTrigger: null,
          evidence: [{ source: "calendar", id: "preview-event-1", label: "Preview calendar event · Operating review", url: null, occurredAt: "2026-07-14T17:00:00.000Z" }],
          sourceConflict: null,
          allowedActions: ["accept_as_task", "dismiss", "draft_response", "run_deeper_research", "adjust"]
        }]
      },
      waitingOn: { additionalItemCount: 0, items: [] },
      personal: {
        additionalItemCount: 0,
        items: [{
          id: "preview-personal-1", canonicalIssueKey: "personal-renewal", kind: "personal_task",
          headline: "Renew personal membership", explanation: "A personal task you explicitly added.",
          priority: "low", confidence: "high", change: "unchanged", rank: null,
          context: null, whyNow: null, recommendedNextMove: null, relatedPeople: [], relatedCompanies: [], relatedTopic: null,
          dueAt: "2026-07-31T07:00:00.000Z", meetingStartAt: null, waitingOn: null, expectedTrigger: null,
          evidence: [{ source: "blackhawk_backend", id: "preview-task-1", label: "Preview personal task", url: null, occurredAt: "2026-07-10T18:00:00.000Z" }],
          sourceConflict: null, allowedActions: ["dismiss", "adjust"]
        }]
      }
    },
    navigation: { investmentCommittee: true, tasksAndWaitingOn: true, adminAndSettings: true }
  }
};
