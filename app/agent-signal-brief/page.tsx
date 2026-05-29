import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { GlanceChip } from "@/components/today/glance-chip";
import { QuietPanel } from "@/components/today/quiet-panel";
import { SupportNote } from "@/components/today/support-note";
import type { ChiefOfStaffSignal, ChiefOfStaffSignalSource } from "@/lib/chief-of-staff-signal";
import { parseAgentProducedMicrosoft365SignalEnvelope } from "@/lib/microsoft-signal-intake";
import { adaptMicrosoft365SignalsToPrototypeDailyBrief } from "@/lib/prototype-daily-brief";
import { PageIntro } from "@/components/shell/page-intro";

const SOURCE_ORDER: ChiefOfStaffSignalSource[] = ["outlook", "teams", "calendar"];

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(new Date(value));
}

function formatSourceHeading(source: ChiefOfStaffSignalSource) {
  switch (source) {
    case "outlook":
      return "Outlook";
    case "teams":
      return "Teams";
    case "calendar":
      return "Calendar";
  }
}

function formatSignalType(signalType: ChiefOfStaffSignal["signalType"]) {
  switch (signalType) {
    case "follow_up":
      return "Follow up";
    case "meeting":
      return "Meeting";
    case "decision":
      return "Decision";
    case "status":
      return "Status";
  }
}

function formatAttention(signal: ChiefOfStaffSignal) {
  if (signal.attention === "high") {
    return "pill-priority";
  }

  if (signal.attention === "medium") {
    return "pill-watch";
  }

  return "pill-live";
}

function isConnectorHealthSignal(signal: ChiefOfStaffSignal) {
  if (signal.signalType !== "status") {
    return false;
  }

  const normalizedTitle = signal.title.toLowerCase();
  const normalizedActionRequest = signal.actionRequest?.toLowerCase() ?? "";

  return (
    normalizedTitle.includes("could not be inspected") ||
    normalizedActionRequest.includes("reauthorize") ||
    normalizedActionRequest.includes("refresh")
  );
}

function SignalCard({ signal }: { signal: ChiefOfStaffSignal }) {
  return (
    <article className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill ${formatAttention(signal)}`}>{signal.attention}</span>
        <span className="chip">{formatSignalType(signal.signalType)}</span>
        {signal.protectedContext ? <span className="chip">Protected</span> : null}
      </div>

      <h4 className="mt-4 text-sm font-medium text-text">{signal.title}</h4>
      <p className="mt-2 text-sm leading-6 text-text-muted">{signal.summary}</p>

      <div className="mt-4 space-y-2 text-sm text-text-muted">
        <p>
          <span className="font-medium text-text">Owner:</span> {signal.owner}
        </p>
        <p>
          <span className="font-medium text-text">Occurred:</span> {formatTimestamp(signal.occurredAt)}
        </p>
        <p>
          <span className="font-medium text-text">Due:</span>{" "}
          {signal.dueAt ? formatTimestamp(signal.dueAt) : "No explicit deadline"}
        </p>
        <p>
          <span className="font-medium text-text">Participants:</span>{" "}
          {signal.participants.length > 0 ? signal.participants.join(", ") : "None listed"}
        </p>
        {signal.actionRequest ? (
          <p>
            <span className="font-medium text-text">Action request:</span> {signal.actionRequest}
          </p>
        ) : null}
      </div>

      {signal.sourceUrl ? (
        <a
          href={signal.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm font-medium text-text transition hover:text-text-muted"
        >
          Open source →
        </a>
      ) : null}
    </article>
  );
}

export default async function AgentSignalBriefPage() {
  const rawFixture = await readFile(
    join(process.cwd(), "fixtures", "chatgpt-agent-microsoft-365-signals.json"),
    "utf8"
  );
  const envelope = parseAgentProducedMicrosoft365SignalEnvelope(JSON.parse(rawFixture) as unknown);
  const dailyBrief = adaptMicrosoft365SignalsToPrototypeDailyBrief(envelope);
  const connectorHealthSignals = dailyBrief.sourceSignals.filter(isConnectorHealthSignal);
  const signalsBySource = SOURCE_ORDER.map((source) => ({
    source,
    heading: formatSourceHeading(source),
    signals: dailyBrief.sourceSignals.filter((signal) => signal.source === source)
  }));

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Local viewer"
        title="Agent Signal Brief"
        description="This page renders the sanitized ChatGPT Agent Microsoft 365 fixture only. It does not add live Microsoft access, connector reuse, or app-owned Outlook runtime behavior."
      />

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <p className="section-label">Source metadata</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-[1.25rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Tenant</p>
              <p className="mt-3 text-sm font-medium text-text">{envelope.tenantLabel}</p>
            </div>
            <div className="rounded-[1.25rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Produced at</p>
              <p className="mt-3 text-sm font-medium text-text">{formatTimestamp(envelope.producedAt)}</p>
            </div>
            <div className="rounded-[1.25rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Signal count</p>
              <p className="mt-3 text-sm font-medium text-text">{envelope.signals.length}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <p className="section-label">Support notes</p>
          <div className="mt-5 grid gap-4">
            {dailyBrief.supportNotes.map((note) => (
              <SupportNote
                key={`${note.eyebrow}-${note.title}`}
                eyebrow={note.eyebrow}
                title={note.title}
                body={note.body}
              />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {dailyBrief.glanceItems.map((item) => (
          <GlanceChip key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.28fr_0.92fr]">
        <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
          <p className="section-label">High focus</p>
          <h3 className="mt-3 text-[1.35rem] font-semibold leading-snug tracking-[-0.01em] text-text md:text-[1.5rem]">
            {dailyBrief.brief.highFocusTitle}
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">
            {dailyBrief.brief.highFocusSummary}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Owner</p>
              <p className="mt-3 text-sm font-medium text-text">{dailyBrief.brief.highFocusOwner}</p>
            </div>
            <div className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Timing</p>
              <p className="mt-3 text-sm font-medium text-text">{dailyBrief.brief.highFocusTiming}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Decision</p>
            <p className="mt-3 text-sm leading-6 text-text-muted">{dailyBrief.brief.highFocusDecision}</p>
          </div>
        </section>

        <QuietPanel
          eyebrow={dailyBrief.brief.quietPanelEyebrow}
          title={dailyBrief.brief.quietPanelTitle}
          items={dailyBrief.quietItems}
        />
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Connector health</p>
        <div className="mt-5 space-y-3">
          {connectorHealthSignals.length > 0 ? (
            connectorHealthSignals.map((signal) => (
              <div
                key={signal.id}
                className="rounded-[1.25rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4"
              >
                <p className="text-sm font-medium text-text">{signal.title}</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">{signal.summary}</p>
                {signal.actionRequest ? (
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    <span className="font-medium text-text">Action request:</span> {signal.actionRequest}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[1.25rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
              <p className="text-sm font-medium text-text">No connector reauthorization or refresh issues surfaced.</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                The sanitized fixture does not currently include status signals that indicate connector inspection gaps or reauthorization needs.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-label">Source signals</p>
          <h3 className="section-title mt-2">Outlook, Teams, and Calendar signals</h3>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {signalsBySource.map((group) => (
            <section key={group.source} className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{group.heading}</p>
                  <h4 className="mt-2 text-base font-medium text-text">{group.signals.length} signals</h4>
                </div>
                <span className="chip">{group.heading}</span>
              </div>

              <div className="mt-5 space-y-3">
                {group.signals.length > 0 ? (
                  group.signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)
                ) : (
                  <div className="rounded-[1.25rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
                    <p className="text-sm font-medium text-text">No {group.heading} signals in this fixture.</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      The viewer stays empty here until the local sanitized payload includes that source.
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
