import { CollapsedPeopleSection } from "@/components/people/collapsed-people-section";
import { OpenLoopRow } from "@/components/people/open-loop-row";
import { PeopleResearchBar } from "@/components/people/people-research-bar";
import { RecentInteractionRow } from "@/components/people/recent-interaction-row";
import { RecentlyViewedStrip } from "@/components/people/recently-viewed-strip";
import { getPeoplePageData } from "@/lib/people";
import { PageIntro } from "@/components/shell/page-intro";

export default async function PeoplePage() {
  const peopleData = await getPeoplePageData();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="People"
        title="Relationship brief first, with the rest kept behind a quiet fold."
        description="This screen stays focused on why the relationship matters now, the next interaction if it truly matters, and only the commitments that still need tracking."
      />

      <PeopleResearchBar />

      <RecentlyViewedStrip />

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="brief-layout gap-4">
          <div className="brief-main">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">1. Current read</p>
            <h2 className="brief-title">
              {peopleData?.currentReadTitle ?? "No relationship brief is available yet."}
            </h2>
            <p className="brief-body">
              {peopleData?.currentReadBody ??
                "Seed the bootstrap user in Supabase to populate the first People brief without requiring auth wiring."}
            </p>
          </div>

          <div className="brief-side space-y-3">
            <div className="rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Quiet state</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                {peopleData?.quietStateNote ?? "No attention needs to be surfaced right now."}
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-accent-red/22 bg-[rgba(125,35,31,0.08)] px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Protected context</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                {peopleData?.protectedContext ?? "No protected context is attached to this brief right now."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">2. Next interaction</p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h3 className="section-title mt-0">
              {peopleData?.nextInteractionTitle ?? "No next interaction needs foreground placement."}
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {peopleData?.nextInteractionNote ??
                "This relationship can stay quiet until a next interaction earns foreground placement."}
            </p>
          </div>
          <div className="rounded-full border border-line/75 bg-white/68 px-4 py-2 text-sm text-text-muted">
            {peopleData?.nextInteractionGuidance ?? "No special guidance is needed"}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">3. Open loops / commitments</p>
        <div className="mt-5 space-y-3">
          {(peopleData?.openLoops ?? []).map((loop) => (
            <OpenLoopRow
              key={`${loop.title}-${loop.due}`}
              title={loop.title}
              owner={loop.owner}
              due={loop.due}
              note={loop.note}
              quiet={loop.quiet}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">4. Recent interactions</p>
        <div className="mt-5 space-y-3">
          {(peopleData?.recentInteractions ?? []).map((interaction) => (
            <RecentInteractionRow
              key={`${interaction.date}-${interaction.title}`}
              date={interaction.date}
              title={interaction.title}
              note={interaction.note}
            />
          ))}
        </div>
      </section>

      <CollapsedPeopleSection
        eyebrow="Deeper layer"
        title="Longer horizon and relationship texture"
        summary="Collapsed by default so the page stays a brief first. Open only when more context is actually useful."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {(peopleData?.deeperLayer ?? []).map((item) => (
            <div key={item.title} className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </CollapsedPeopleSection>
    </div>
  );
}
