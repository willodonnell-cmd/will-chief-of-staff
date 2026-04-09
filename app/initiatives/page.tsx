import { CollapsedInitiativeSection } from "@/components/initiatives/collapsed-initiative-section";
import { KeyChangeRow } from "@/components/initiatives/key-change-row";
import { SupportingPoint } from "@/components/initiatives/supporting-point";
import { getInitiativesPageData } from "@/lib/initiatives";
import { PageIntro } from "@/components/shell/page-intro";

export default async function InitiativesPage() {
  const initiativesData = await getInitiativesPageData();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Initiatives"
        title="Strategic brief first, with the rest kept behind a quiet fold."
        description="This view stays minimal up front: why the initiative matters now, what it is, where the tensions are, and what changed since the last review."
      />

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="brief-layout gap-4">
          <div className="brief-main">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">1. Why this matters now</p>
            <h2 className="brief-title">{initiativesData?.whyNowTitle ?? "No initiative brief is available yet."}</h2>
            <p className="brief-body">
              {initiativesData?.whyNowSummary ??
                "Seed the bootstrap user in Supabase to populate the first initiative brief without requiring auth wiring."}
            </p>
          </div>

          <div className="brief-side space-y-3">
            <div className="rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Attention state</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                {initiativesData?.attentionStateNote ?? "No additional attention is needed right now."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">2. Initiative summary / context</p>
        <div className="mt-4 max-w-3xl">
          <h3 className="section-title mt-0">{initiativesData?.summaryTitle ?? "No summary is available yet."}</h3>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            {initiativesData?.summaryBody ?? "No initiative summary is available yet."}
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">3. Current risks / tensions</p>
        <div className="mt-4 space-y-3">
          <p className="text-base font-medium text-text">{initiativesData?.riskFraming ?? "No active tension is available yet."}</p>
          {(initiativesData?.riskPoints ?? []).map((point) => (
            <SupportingPoint key={point}>{point}</SupportingPoint>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">4. Key changes since last review</p>
        <div className="mt-5 space-y-3">
          {(initiativesData?.keyChanges ?? []).map((change) => (
            <KeyChangeRow key={`${change.date}-${change.title}`} date={change.date} title={change.title} note={change.note} />
          ))}
        </div>
      </section>

      <CollapsedInitiativeSection
        eyebrow="5"
        title="Key people / stakeholders"
        summary="Expanded only when stakeholder shape matters to the current decision."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {(initiativesData?.stakeholders ?? []).map((stakeholder) => (
            <div key={stakeholder.title} className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
              <p className="text-sm font-medium text-text">{stakeholder.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{stakeholder.note}</p>
            </div>
          ))}
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="6"
        title="Related signals / strategic themes"
        summary="Signals that support the initiative but do not need constant foreground placement."
      >
        <div className="space-y-3">
          {(initiativesData?.relatedSignals ?? []).map((signal) => (
            <SupportingPoint key={signal}>{signal}</SupportingPoint>
          ))}
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="7"
        title="Open loops / commitments"
        summary="Held behind the fold unless they materially change the current read."
      >
        <div className="space-y-3">
          {(initiativesData?.openLoops ?? []).map((loop) => (
            <div key={loop.title} className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
              <p className="text-sm font-medium text-text">{loop.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{loop.note}</p>
            </div>
          ))}
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="8"
        title="Timeline / history"
        summary="Chronology stays hidden by default unless the decision depends on sequence."
      >
        <div className="space-y-3">
          {(initiativesData?.timelineEvents ?? []).map((event) => (
            <KeyChangeRow key={`${event.date}-${event.title}`} date={event.date} title={event.title} note={event.note} />
          ))}
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="9"
        title="Related briefings / linked artifacts"
        summary="Artifacts stay behind progressive disclosure until they are actually needed."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {(initiativesData?.linkedArtifacts ?? []).map((artifact) => (
            <div key={artifact.title} className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
              <p className="text-sm font-medium text-text">{artifact.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{artifact.note}</p>
            </div>
          ))}
        </div>
      </CollapsedInitiativeSection>

      <CollapsedInitiativeSection
        eyebrow="10"
        title="Goals / success markers"
        summary="Success markers exist, but stay folded until measurement is the current question."
      >
        <div className="space-y-3">
          {(initiativesData?.goalMarkers ?? []).map((goal) => (
            <SupportingPoint key={goal}>{goal}</SupportingPoint>
          ))}
        </div>
      </CollapsedInitiativeSection>
    </div>
  );
}
