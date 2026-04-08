import { CollapsedInitiativeSection } from "@/components/initiatives/collapsed-initiative-section";
import { KeyChangeRow } from "@/components/initiatives/key-change-row";
import { SupportingPoint } from "@/components/initiatives/supporting-point";
import { PageIntro } from "@/components/shell/page-intro";

export default function InitiativesPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Initiatives"
        title="Strategic brief first, with the rest kept behind a quiet fold."
        description="This view stays minimal up front: why the initiative matters now, what it is, where the tensions are, and what changed since the last review."
      />

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">1. Why this matters now</p>
            <h2 className="mt-3 text-[1.85rem] font-medium tracking-[-0.04em] text-text md:text-[2.45rem]">
              Executive operating rhythm matters now because the board offsite is forcing strategy, staffing, and decision
              hygiene into the same conversation window.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted md:text-base">
              If the operating rhythm is framed clearly, the offsite becomes a converging point. If it stays fuzzy, the
              same work gets rediscovered in three different rooms.
            </p>
          </div>

          <div className="space-y-3 lg:max-w-[18rem]">
            <div className="rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Attention state</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                No additional attention is needed after Friday if the board framing lands cleanly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">2. Initiative summary / context</p>
        <div className="mt-4 max-w-3xl">
          <h3 className="text-xl font-medium tracking-[-0.02em] text-text">Create a calmer executive operating system for planning, triage, and follow-through.</h3>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            This initiative is about turning scattered executive work into a quieter operating surface. The immediate scope
            is not more tooling; it is cleaner visibility, better pacing, and fewer duplicated loops across inbox, people,
            initiatives, and commitments.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">3. Current risks / tensions</p>
        <div className="mt-4 space-y-3">
          <p className="text-base font-medium text-text">
            The main tension is between building enough structure to help and adding enough interface to become noise.
          </p>
          <SupportingPoint>Pressure to surface more data could turn the product into a dashboard instead of a brief.</SupportingPoint>
          <SupportingPoint>Several workflows are related, but merging them too early would blur decision ownership.</SupportingPoint>
          <SupportingPoint>Board-offsite urgency can accidentally pull long-horizon operating work into short-term aesthetics.</SupportingPoint>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">4. Key changes since last review</p>
        <div className="mt-5 space-y-3">
          <KeyChangeRow
            date="Today"
            title="Capture flow is live inside the shared shell"
            note="Context inheritance, privacy handling, and quiet confirmation behavior are now implemented."
          />
          <KeyChangeRow
            date="Today"
            title="Priority Inbox is now triage-first"
            note="The surfaced set is intentionally small, with compact rows and only rare elevated emphasis."
          />
          <KeyChangeRow
            date="Today"
            title="People views now lead with relationship briefs"
            note="The page hierarchy is oriented around why a person matters now rather than recent activity volume."
          />
        </div>
      </section>

      <CollapsedInitiativeSection
        eyebrow="5"
        title="Key people / stakeholders"
        summary="Expanded only when stakeholder shape matters to the current decision."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
            <p className="text-sm font-medium text-text">Will</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Decision owner for pacing, product posture, and what earns foreground attention.</p>
          </div>
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
            <p className="text-sm font-medium text-text">Chief of staff workflows</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Primary proving ground for whether the system reduces noise instead of reorganizing it.</p>
          </div>
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="6"
        title="Related signals / strategic themes"
        summary="Signals that support the initiative but do not need constant foreground placement."
      >
        <div className="space-y-3">
          <SupportingPoint>Board prep is exposing where narrative alignment and operating alignment diverge.</SupportingPoint>
          <SupportingPoint>Inbox, People, and Capture are becoming the visible edge of one deeper executive rhythm problem.</SupportingPoint>
          <SupportingPoint>Suppression quality is emerging as a more important success factor than relevance scoring.</SupportingPoint>
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="7"
        title="Open loops / commitments"
        summary="Held behind the fold unless they materially change the current read."
      >
        <div className="space-y-3">
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
            <p className="text-sm font-medium text-text">Document the committed scope for the first executive workflows.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Needed before the board offsite so the initiative is described as operating logic, not a loose product sketch.</p>
          </div>
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
            <p className="text-sm font-medium text-text">Confirm what remains intentionally out of scope for this cycle.</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">This prevents calmness from being eroded by opportunistic additions.</p>
          </div>
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="8"
        title="Timeline / history"
        summary="Chronology stays hidden by default unless the decision depends on sequence."
      >
        <div className="space-y-3">
          <KeyChangeRow
            date="Initial shell"
            title="Responsive app foundation established"
            note="One responsive web app, dark shell, mineral plane, and persistent cross-device navigation."
          />
          <KeyChangeRow
            date="Capture"
            title="Always-available capture implemented"
            note="Mobile center action and desktop persistent action now route into a shared capture flow."
          />
          <KeyChangeRow
            date="Current"
            title="Strategic brief surfaces now being added by area"
            note="Today, Inbox, People, and Initiatives are being shaped around distinct executive postures rather than generic lists."
          />
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="9"
        title="Related briefings / linked artifacts"
        summary="Artifacts stay behind progressive disclosure until they are actually needed."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
            <p className="text-sm font-medium text-text">Technical architecture memo</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">Working record of shell decisions, capture flow, inbox decisions, and people-page posture.</p>
          </div>
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
            <p className="text-sm font-medium text-text">Cursor rules and product defaults</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">The governing constraints that keep the initiative from drifting into urgency-heavy design.</p>
          </div>
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="10"
        title="Goals / success markers"
        summary="Success markers exist, but stay folded until measurement is the current question."
      >
        <div className="space-y-3">
          <SupportingPoint>The system reliably says when nothing needs attention right now.</SupportingPoint>
          <SupportingPoint>Executive screens read as briefs first, not dashboards or task managers.</SupportingPoint>
          <SupportingPoint>Capture, Inbox, People, and Initiatives reinforce one operating rhythm instead of four separate tools.</SupportingPoint>
        </div>
      </CollapsedInitiativeSection>
    </div>
  );
}
