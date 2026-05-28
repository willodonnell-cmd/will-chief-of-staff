"use client";

import { useEffect, useState } from "react";

import { QuickCapturePanel } from "@/components/capture/quick-capture-panel";
import type {
  ChiefOfStaffCard,
  ChiefOfStaffDashboardData,
  DashboardAction,
  DashboardReviewState,
  PreparedBrief,
  PreparedBriefSection
} from "@/src/chief-of-staff-dashboard-state";
import {
  applyDashboardAction,
  deriveDashboardView,
  formatDashboardSource
} from "@/src/chief-of-staff-dashboard-state";

const STORAGE_KEY = "blackhawk.chief-of-staff-dashboard.v1";

function subtlePillClass() {
  return "rounded-full border border-line/70 bg-white/72 px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle";
}

function primaryButtonClass() {
  return "rounded-full border border-[rgb(var(--color-shell))] bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-95";
}

function secondaryButtonClass() {
  return "rounded-full border border-line/75 bg-white/82 px-3 py-2 text-sm text-text-muted transition hover:bg-white hover:text-text";
}

function sourceButtonClass() {
  return "rounded-full border border-line/55 bg-white/42 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-text-subtle transition hover:bg-white/68 hover:text-text";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function tomorrowDate() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function briefInfoOptions(level: PreparedBrief["level"]) {
  const base = [
    {
      key: "recent-context",
      label: "Recent context",
      body: "Pull the most recent source-grounded context back into the brief so the conversation starts with the current read, not the whole backstory."
    },
    {
      key: "talking-points",
      label: "Talking points",
      body: "Add a tighter talking-points pass that keeps the meeting narrow, source-grounded, and decision-oriented."
    },
    {
      key: "sources",
      label: "Sources",
      body: "Expand the available sources so the brief can be traced back quickly without turning into raw source exhaust."
    }
  ];

  if (level === "light") {
    return base;
  }

  const standard = [
    ...base,
    {
      key: "decisions-likely-needed",
      label: "Decisions likely needed",
      body: "Add the likely calls or confirmations that could surface in the meeting, plus the clean next move afterward."
    },
    {
      key: "commitments-open-loops",
      label: "Commitments and open loops",
      body: "Add the explicit commitments, owners, and follow-up items that should be captured or moved to Waiting On."
    },
    {
      key: "related-sources",
      label: "Related sources",
      body: "Add the adjacent documents, notes, or meeting anchors that matter enough to keep nearby."
    }
  ];

  if (level === "standard") {
    return standard;
  }

  return [
    ...standard,
    {
      key: "relationship-context",
      label: "Relationship context",
      body: "Add the stakeholder dynamic, what the counterpart likely cares about, and what should stay out of the conversation unless it materially changes the read."
    },
    {
      key: "risks-tensions",
      label: "Risks and tensions",
      body: "Add the real risks, tensions, or unresolved edges that could change the meeting outcome."
    },
    {
      key: "strategic-context",
      label: "Strategic context",
      body: "Add the higher-level strategic frame so the meeting is tied to the real executive priority rather than status theater."
    },
    {
      key: "key-historical-notes",
      label: "Key historical notes",
      body: "Add only the source-grounded historical context that is actually useful for this meeting."
    }
  ];
}

function SourceDisclosure({
  anchor,
  summary,
  href,
  extra
}: {
  anchor: string;
  summary: string;
  href?: string | null;
  extra?: string | null;
}) {
  return (
    <details className="mt-4 inline-block">
      <summary className={sourceButtonClass()}>Source</summary>
      <div className="mt-2 max-w-[28rem] rounded-[0.9rem] border border-line/55 bg-white/54 px-3 py-2.5">
        <p className="text-[0.78rem] leading-5 text-text-muted">{anchor}</p>
        <p className="mt-1 text-[0.78rem] leading-5 text-text-muted">{summary}</p>
        {extra ? <p className="mt-1 text-[0.78rem] leading-5 text-text-muted">{extra}</p> : null}
        {href ? (
          <a href={href} className="mt-1.5 inline-flex text-[0.78rem] text-text-muted transition hover:text-text">
            Open source route
          </a>
        ) : null}
      </div>
    </details>
  );
}

function DashboardCard({
  card,
  onAction
}: {
  card: ChiefOfStaffCard;
  onAction: (action: DashboardAction) => void;
}) {
  const [snoozeDate, setSnoozeDate] = useState(tomorrowDate());
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);

  return (
    <article className="rounded-[1.5rem] border border-line/75 bg-white/72 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={subtlePillClass()}>{card.priority}</span>
        <span className={subtlePillClass()}>{formatDashboardSource(card.source)}</span>
        <span className={subtlePillClass()}>{card.confidence}</span>
      </div>

      <h3 className="mt-4 text-[1.05rem] font-medium leading-6 tracking-[-0.02em] text-text">{card.title}</h3>
      <p className="mt-2 text-sm leading-6 text-text">{card.reason}</p>
      <p className="mt-3 text-sm leading-6 text-text-muted">{card.description}</p>

      <div className="mt-4 rounded-[1.15rem] border border-line/70 bg-[rgba(255,255,255,0.58)] px-4 py-3">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Recommended action</p>
        <p className="mt-2 text-sm font-medium leading-6 text-text">{card.recommendedAction}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass()} onClick={() => onAction({ type: "done", id: card.id })}>
          Done
        </button>
        {card.counterparty && card.expectedOutcome ? (
          <button
            type="button"
            className={secondaryButtonClass()}
            onClick={() =>
              onAction({
                type: "move_to_waiting_on",
                id: card.id,
                counterparty: card.counterparty ?? "Counterparty needs to be confirmed",
                expectedOutcome: card.expectedOutcome ?? "Expected outcome needs to be confirmed"
              })
            }
          >
            Move to Waiting On
          </button>
        ) : null}
        <button
          type="button"
          className={secondaryButtonClass()}
          onClick={() => setIsSnoozeOpen((current) => !current)}
        >
          Snooze
        </button>
        <button type="button" className={secondaryButtonClass()} onClick={() => onAction({ type: "park", id: card.id })}>
          Park
        </button>
        <button type="button" className={secondaryButtonClass()} onClick={() => onAction({ type: "dismiss", id: card.id })}>
          Dismiss
        </button>
      </div>

      {isSnoozeOpen ? (
        <div className="mt-3 rounded-[1.1rem] border border-line/70 bg-white/62 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <span>Snooze until</span>
              <input
                type="date"
                value={snoozeDate}
                onChange={(event) => setSnoozeDate(event.target.value)}
                className="rounded-full border border-line/70 bg-white/82 px-3 py-1.5 text-sm text-text outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={primaryButtonClass()}
                onClick={() => {
                  onAction({ type: "snooze", id: card.id, until: `${snoozeDate}T09:00:00-07:00` });
                  setIsSnoozeOpen(false);
                }}
              >
                Confirm Snooze
              </button>
              <button type="button" className={secondaryButtonClass()} onClick={() => setIsSnoozeOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {card.dueDate ? <p className="mt-3 text-sm text-text-muted">Due {card.dueDate}</p> : null}

      <SourceDisclosure anchor={card.sourceAnchor} summary={card.sourceSummary} href={card.sourceHref} />
    </article>
  );
}

function PreparedBriefCard({
  brief,
  onComplete
}: {
  brief: PreparedBrief;
  onComplete: (action: DashboardAction) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreInfoOpen, setIsMoreInfoOpen] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [addedSections, setAddedSections] = useState<PreparedBriefSection[]>([]);
  const availableOptions = briefInfoOptions(brief.level);

  function addSection(section: PreparedBriefSection) {
    setAddedSections((current) => {
      if (current.some((item) => item.label === section.label)) {
        return current;
      }

      return [...current, section];
    });
  }

  return (
    <article className="refined-b rounded-[1.75rem] p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className={subtlePillClass()}>Prepared brief</span>
        <span className={subtlePillClass()}>{brief.level}</span>
        <span className={subtlePillClass()}>{formatDashboardSource(brief.source)}</span>
      </div>

      <h3 className="mt-4 text-[1.08rem] font-medium leading-6 tracking-[-0.02em] text-text">{brief.meetingTitle}</h3>
      <p className="mt-2 text-sm leading-6 text-text">{brief.whyShown}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">Starts {formatDateTime(brief.startsAt)}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass()} onClick={() => setIsOpen((current) => !current)}>
          {isOpen ? "Close brief" : "Open brief"}
        </button>
        <button type="button" className={secondaryButtonClass()} onClick={() => setIsMoreInfoOpen((current) => !current)}>
          {isMoreInfoOpen ? "Close more info" : "More info"}
        </button>
        <button type="button" className={secondaryButtonClass()} onClick={() => onComplete({ type: "complete_prepared_brief", id: brief.id })}>
          Mark complete
        </button>
      </div>

      {isMoreInfoOpen ? (
        <div className="mt-4 rounded-[1.15rem] border border-line/70 bg-white/66 px-4 py-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Add more info</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Add one of the categories for this {brief.level} brief, or add a custom query and keep it attached to the prep packet.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {availableOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={secondaryButtonClass()}
                onClick={() => addSection({ label: option.label, body: option.body })}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="text"
              value={customQuery}
              onChange={(event) => setCustomQuery(event.target.value)}
              placeholder="Add a custom query to this brief"
              className="min-w-0 flex-1 rounded-full border border-line/70 bg-white/82 px-4 py-2.5 text-sm text-text outline-none"
            />
            <button
              type="button"
              className={primaryButtonClass()}
              onClick={() => {
                const value = customQuery.trim();
                if (!value) {
                  return;
                }

                addSection({
                  label: `Custom query: ${value}`,
                  body: `Keep this query attached to the brief and answer it from source-grounded context: ${value}`
                });
                setCustomQuery("");
              }}
            >
              Add query
            </button>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div className="mt-5 space-y-4">
          {[...brief.sections, ...addedSections].map((section) => (
            <section key={section.label} className="rounded-[1.1rem] border border-line/70 bg-white/62 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{section.label}</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text">{section.body}</p>
            </section>
          ))}
        </div>
      ) : null}

      <SourceDisclosure anchor={brief.sourceAnchor} summary={brief.sourceSummary} href={brief.sourceHref} />
    </article>
  );
}

export function ChiefOfStaffWorkspace({ data }: { data: ChiefOfStaffDashboardData }) {
  const [reviewState, setReviewState] = useState<DashboardReviewState>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as DashboardReviewState;
      if (parsed && typeof parsed === "object") {
        setReviewState(parsed);
      }
    } catch {
      // Ignore invalid local dashboard state and continue with defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewState));
  }, [reviewState]);

  const view = deriveDashboardView(data, reviewState, new Date().toISOString());

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Decisions Needed</p>
            <h2 className="section-title">Only real decisions. No FYIs, no vague prompts.</h2>
          </div>
          <span className={subtlePillClass()}>{view.decisionsNeeded.length} visible</span>
        </div>
        {view.decisionsNeeded.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.decisionsNeeded}</p>
          ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {view.decisionsNeeded.map((card) => (
              <DashboardCard key={card.id} card={card} onAction={(action) => setReviewState((current) => applyDashboardAction(current, action))} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">People Waiting on Will</p>
            <h2 className="section-title">Active source-grounded asks that look like Will owes the next move.</h2>
          </div>
          <span className={subtlePillClass()}>{view.peopleWaitingOnWillCount} total</span>
        </div>
        {view.peopleWaitingOnWill.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.peopleWaitingOnWill}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {view.peopleWaitingOnWill.map((card) => (
              <article key={card.id} className="rounded-[1.5rem] border border-line/75 bg-white/72 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={subtlePillClass()}>{card.priority}</span>
                  <span className={subtlePillClass()}>{formatDashboardSource(card.source)}</span>
                  <span className={subtlePillClass()}>{card.confidence}</span>
                </div>
                <h3 className="mt-4 text-[1.05rem] font-medium leading-6 tracking-[-0.02em] text-text">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text">{card.reason}</p>
                <p className="mt-3 text-sm leading-6 text-text-muted">{card.description}</p>
                <div className="mt-4 rounded-[1.15rem] border border-line/70 bg-[rgba(255,255,255,0.58)] px-4 py-3">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Counterparty</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-text">{card.counterparty}</p>
                  <p className="mt-3 text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Expected outcome</p>
                  <p className="mt-2 text-sm leading-6 text-text">{card.expectedOutcome}</p>
                </div>
                <SourceDisclosure anchor={card.sourceAnchor} summary={card.sourceSummary} href={card.sourceHref} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Priority Emails / Inbox Items</p>
            <h2 className="section-title">The remaining active inbox layer after decisions and direct asks are carved out.</h2>
          </div>
          <span className={subtlePillClass()}>{view.priorityInboxItems.length} visible</span>
        </div>
        {view.priorityInboxItems.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.priorityInboxItems}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {view.priorityInboxItems.map((card) => (
              <DashboardCard key={card.id} card={card} onAction={(action) => setReviewState((current) => applyDashboardAction(current, action))} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Meeting Prep</p>
            <h2 className="section-title">Prepared from due-soon Calendar and Agenda tasks until a real calendar source exists.</h2>
          </div>
          <span className={subtlePillClass()}>{view.preparedBriefs.length} prepared</span>
        </div>

        <div className="space-y-4">
          <div>
            {view.preparedBriefs.length === 0 ? (
              <p className="mt-3 rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.meetingPrep}</p>
            ) : (
              <div className="mt-3 space-y-4">
                {view.preparedBriefs.map((brief) => (
                  <PreparedBriefCard
                    key={brief.id}
                    brief={brief}
                    onComplete={(action) => setReviewState((current) => applyDashboardAction(current, action))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Strategic FYIs</p>
            <h2 className="section-title">Durable context worth keeping nearby without promoting it into immediate action.</h2>
          </div>
          <span className={subtlePillClass()}>{view.strategicFyis.length} visible</span>
        </div>
        {view.strategicFyis.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.strategicFyis}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {view.strategicFyis.map((card) => (
              <DashboardCard key={card.id} card={card} onAction={(action) => setReviewState((current) => applyDashboardAction(current, action))} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Follow-ups / Open Loops</p>
            <h2 className="section-title">Canonical tasks that still look operationally live.</h2>
          </div>
          <span className={subtlePillClass()}>{view.followUpsOpenLoops.length} visible</span>
        </div>
        {view.followUpsOpenLoops.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.followUpsOpenLoops}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {view.followUpsOpenLoops.map((card) => (
              <DashboardCard key={card.id} card={card} onAction={(action) => setReviewState((current) => applyDashboardAction(current, action))} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Recently Captured</p>
            <h2 className="section-title">Recent notes and tasks worth one last pass before they fade into the library.</h2>
          </div>
          <span className={subtlePillClass()}>{view.recentlyCaptured.length} visible</span>
        </div>
        {view.recentlyCaptured.length === 0 ? (
          <p className="rounded-[1.5rem] border border-line/75 bg-white/72 px-5 py-5 text-sm leading-6 text-text-muted">{data.emptyStates.recentlyCaptured}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {view.recentlyCaptured.map((card) => (
              <DashboardCard key={card.id} card={card} onAction={(action) => setReviewState((current) => applyDashboardAction(current, action))} />
            ))}
          </div>
        )}
      </section>

      <QuickCapturePanel sourcePath="/" />

      <section className="rounded-[1.4rem] border border-line/70 bg-white/62 px-5 py-4">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Low-value noise filtered out</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{view.lowValueNoiseFiltered.label}</p>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Links</p>
        <h2 className="section-title">Durable context stays separate from the active attention layer.</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <a href={data.links.brainHref} className="rounded-[1.2rem] border border-line/70 bg-white/75 px-4 py-4 text-sm font-medium text-text transition hover:bg-white">
            Brain
            <p className="mt-2 text-sm font-normal leading-6 text-text-muted">Open the current Library and durable context surface.</p>
          </a>
          <a href={data.links.vaultSearchHref} className="rounded-[1.2rem] border border-line/70 bg-white/75 px-4 py-4 text-sm font-medium text-text transition hover:bg-white">
            Vault Search
            <p className="mt-2 text-sm font-normal leading-6 text-text-muted">Use the current searchable Library surface for retrieval.</p>
          </a>
          <a href={data.links.investmentAgentHref} className="rounded-[1.2rem] border border-line/70 bg-white/75 px-4 py-4 text-sm font-medium text-text transition hover:bg-white">
            Investment Agent
            <p className="mt-2 text-sm font-normal leading-6 text-text-muted">Separate public-markets entry point, not mixed into Chief of Staff routing.</p>
          </a>
        </div>
      </section>
    </div>
  );
}
