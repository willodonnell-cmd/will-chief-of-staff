import { SignalCaptureActions } from "@/components/agent-signal/signal-capture-actions";
import { PageIntro } from "@/components/shell/page-intro";
import { GlanceChip } from "@/components/today/glance-chip";
import { QuietPanel } from "@/components/today/quiet-panel";
import { SupportNote } from "@/components/today/support-note";
import type { CSSProperties } from "react";
import {
  getDisplaySourceHref,
  getAgentSignalBriefIntroDescription,
  getConnectorHealthEmptyStateDetail,
  getEmptySourceGroupDetail,
  getQuietItemsFallbackDetail,
  isConnectorHealthSignal,
  sanitizeDisplayText
} from "@/lib/agent-signal-brief";
import type { ChiefOfStaffSignal, ChiefOfStaffSignalSource } from "@/lib/chief-of-staff-signal";
import { loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource } from "@/lib/microsoft-signal-intake";
import { adaptMicrosoft365SignalsToPrototypeDailyBrief } from "@/lib/prototype-daily-brief";

const SOURCE_ORDER: ChiefOfStaffSignalSource[] = ["outlook", "teams", "calendar"];
const ANYWHERE_TEXT_STYLE: CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "break-word"
};
const CLAMP_3_TEXT_STYLE: CSSProperties = {
  ...ANYWHERE_TEXT_STYLE,
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3
};
const CLAMP_4_TEXT_STYLE: CSSProperties = {
  ...ANYWHERE_TEXT_STYLE,
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 4
};
const CLAMP_5_TEXT_STYLE: CSSProperties = {
  ...ANYWHERE_TEXT_STYLE,
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 5
};

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

function SignalCard({ signal }: { signal: ChiefOfStaffSignal }) {
  const displayTitle = sanitizeDisplayText(signal.title) || signal.title;
  const displaySummary = sanitizeDisplayText(signal.summary) || signal.summary;
  const displayActionRequest = signal.actionRequest
    ? sanitizeDisplayText(signal.actionRequest) || signal.actionRequest
    : null;
  const sourceHref = getDisplaySourceHref(signal.sourceUrl);
  const canCreateCapture = !isConnectorHealthSignal(signal);

  return (
    <article className="min-w-0 overflow-hidden rounded-[1.35rem] border border-line/70 bg-white/70 p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={`pill ${formatAttention(signal)}`}>{signal.attention}</span>
        <span className="chip">{formatSignalType(signal.signalType)}</span>
        {signal.protectedContext ? <span className="chip">Protected</span> : null}
      </div>

      <h4 className="mt-4 text-base font-medium leading-6 text-text" style={CLAMP_3_TEXT_STYLE}>
        {displayTitle}
      </h4>
      <p className="mt-2 text-sm leading-6 text-text-muted" style={CLAMP_5_TEXT_STYLE}>
        {displaySummary}
      </p>

      <div className="mt-5 min-w-0 space-y-3 border-t border-line/60 pt-4 text-sm text-text-muted">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className="rounded-full border border-line/70 bg-white/78 px-3 py-1.5 text-text-muted"
            style={ANYWHERE_TEXT_STYLE}
          >
            {signal.owner}
          </span>
          <span>Occurred {formatTimestamp(signal.occurredAt)}</span>
          <span>{signal.dueAt ? `Due ${formatTimestamp(signal.dueAt)}` : "No explicit deadline"}</span>
        </div>
        <p style={ANYWHERE_TEXT_STYLE}>
          <span className="font-medium text-text">Participants:</span>{" "}
          {signal.participants.length > 0 ? signal.participants.join(", ") : "None listed"}
        </p>
        {displayActionRequest ? (
          <p style={ANYWHERE_TEXT_STYLE}>
            <span className="font-medium text-text">Action request:</span> {displayActionRequest}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm font-medium text-text transition hover:text-text-muted"
          >
            Open source →
          </a>
        ) : null}
        {canCreateCapture ? <SignalCaptureActions signal={signal} /> : null}
      </div>
    </article>
  );
}

export default async function InboxPage() {
  const { envelope, source } = await loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource();
  const dailyBrief = adaptMicrosoft365SignalsToPrototypeDailyBrief(envelope);
  const connectorHealthSignals = dailyBrief.sourceSignals.filter(isConnectorHealthSignal);
  const quietItems =
    dailyBrief.quietItems.length > 0
      ? dailyBrief.quietItems
      : [
          {
            label: "No background signals are waiting right now.",
            detail: getQuietItemsFallbackDetail()
          }
        ];
  const signalsBySource = SOURCE_ORDER.map((signalSource) => ({
    source: signalSource,
    heading: formatSourceHeading(signalSource),
    signals: dailyBrief.sourceSignals.filter((signal) => signal.source === signalSource)
  }));
  const populatedSourceCount = signalsBySource.filter((group) => group.signals.length > 0).length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Priority Inbox"
        title="Priority Inbox"
        description={getAgentSignalBriefIntroDescription(source)}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {dailyBrief.glanceItems.map((item) => (
          <GlanceChip key={item.label} label={item.label} value={item.value} tone={item.tone} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.24fr_0.86fr]">
        <section className="refined-b min-w-0 overflow-hidden rounded-[1.9rem] p-5 md:p-7">
          <div className="brief-layout gap-5">
            <div className="brief-main">
              <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Priority focus</p>
              <h2
                className="mt-3 max-w-full text-[1.28rem] font-semibold leading-[1.24] tracking-[-0.02em] text-text md:text-[1.55rem]"
                style={CLAMP_4_TEXT_STYLE}
              >
                {dailyBrief.brief.highFocusTitle}
              </h2>
              <p
                className="mt-3 max-w-3xl text-sm leading-6 text-text-muted md:text-[0.98rem]"
                style={ANYWHERE_TEXT_STYLE}
              >
                {dailyBrief.brief.highFocusSummary}
              </p>

              <div className="mt-5 min-w-0 rounded-[1.35rem] border border-line/70 bg-white/66 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Recommended action</p>
                <p className="mt-3 text-sm leading-6 text-text-muted" style={ANYWHERE_TEXT_STYLE}>
                  {dailyBrief.brief.highFocusDecision}
                </p>
              </div>
            </div>

            <div className="brief-side space-y-3">
              <div className="min-w-0 rounded-[1.35rem] border border-line/75 bg-white/68 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Owner</p>
                <p className="mt-3 text-sm font-medium text-text" style={ANYWHERE_TEXT_STYLE}>
                  {dailyBrief.brief.highFocusOwner}
                </p>
              </div>
              <div className="min-w-0 rounded-[1.35rem] border border-line/75 bg-white/68 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Timing</p>
                <p className="mt-3 text-sm font-medium text-text" style={ANYWHERE_TEXT_STYLE}>
                  {dailyBrief.brief.highFocusTiming}
                </p>
              </div>
              <div className="min-w-0 rounded-[1.35rem] border border-line/75 bg-white/68 px-4 py-4">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Payload scope</p>
                <p className="mt-3 text-sm leading-6 text-text-muted" style={ANYWHERE_TEXT_STYLE}>
                  {envelope.signals.length} signals across {populatedSourceCount} active sources.
                </p>
              </div>
            </div>
          </div>
        </section>

        <QuietPanel
          eyebrow={dailyBrief.brief.quietPanelEyebrow}
          title={dailyBrief.brief.quietPanelTitle}
          items={quietItems}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="min-w-0 rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Payload metadata</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="min-w-0 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Inbox source</p>
              <p className="mt-3 text-sm font-medium text-text" style={ANYWHERE_TEXT_STYLE}>
                {source === "local" ? "Local Agent payload" : "Sanitized fixture"}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Tenant</p>
              <p className="mt-3 text-sm font-medium text-text" style={ANYWHERE_TEXT_STYLE}>
                {envelope.tenantLabel}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Produced at</p>
              <p className="mt-3 text-sm font-medium text-text" style={ANYWHERE_TEXT_STYLE}>
                {formatTimestamp(envelope.producedAt)}
              </p>
            </div>
            <div className="min-w-0 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Signal count</p>
              <p className="mt-3 text-sm font-medium text-text">{envelope.signals.length}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {dailyBrief.supportNotes.map((note) => (
            <SupportNote
              key={`${note.eyebrow}-${note.title}`}
              eyebrow={note.eyebrow}
              title={note.title}
              body={note.body}
            />
          ))}

          <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Connector health</p>
            <div className="mt-5 space-y-3">
              {connectorHealthSignals.length > 0 ? (
                connectorHealthSignals.map((signal) => (
                  <div key={signal.id} className="min-w-0 rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                    <p className="text-sm font-medium text-text" style={ANYWHERE_TEXT_STYLE}>
                      {sanitizeDisplayText(signal.title) || signal.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-text-muted" style={ANYWHERE_TEXT_STYLE}>
                      {sanitizeDisplayText(signal.summary) || signal.summary}
                    </p>
                    {signal.actionRequest ? (
                      <p className="mt-2 text-sm leading-6 text-text-muted" style={ANYWHERE_TEXT_STYLE}>
                        <span className="font-medium text-text">Action request:</span>{" "}
                        {sanitizeDisplayText(signal.actionRequest) || signal.actionRequest}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                  <p className="text-sm font-medium text-text">No connector health issues surfaced.</p>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    {getConnectorHealthEmptyStateDetail()}
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Source signals</p>
          <h3 className="mt-2 text-[1.2rem] font-semibold leading-snug tracking-[-0.01em] text-text md:text-[1.35rem]">
            Outlook, Teams, and Calendar signals
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
            Priority Inbox groups signals by source so the route stays brief-first, then supporting context, then detailed cards.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {signalsBySource.map((group) => (
            <section key={group.source} className="min-w-0 rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{group.heading}</p>
                  <h4 className="mt-2 text-lg font-medium tracking-[-0.01em] text-text">
                    {group.signals.length} signals
                  </h4>
                </div>
                <span className="chip">{group.heading}</span>
              </div>

              <div className="mt-5 space-y-3">
                {group.signals.length > 0 ? (
                  group.signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)
                ) : (
                  <div className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                    <p className="text-sm font-medium text-text">{getEmptySourceGroupDetail(group.heading)}</p>
                    <p className="mt-2 text-sm leading-6 text-text-muted">
                      The inbox stays empty here until this payload includes that source.
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
