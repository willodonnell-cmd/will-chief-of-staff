import { CollapsedPeopleSection } from "@/components/people/collapsed-people-section";
import { OpenLoopRow } from "@/components/people/open-loop-row";
import { RecentInteractionRow } from "@/components/people/recent-interaction-row";
import { PageIntro } from "@/components/shell/page-intro";

export default function PeoplePage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="People"
        title="Relationship brief first, with the rest kept behind a quiet fold."
        description="This screen stays focused on why the relationship matters now, the next interaction if it truly matters, and only the commitments that still need tracking."
      />

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="brief-layout gap-4">
          <div className="brief-main">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">1. Current read</p>
            <h2 className="brief-title">
              Amelia Hart matters now because she is the shortest path to keeping the board narrative coherent.
            </h2>
            <p className="brief-body">
              She is the trusted translator between recruiting reality and board language. If her framing holds,
              tomorrow&apos;s prep stays tight. If it drifts, the week gets noisier than it needs to be.
            </p>
          </div>

          <div className="brief-side space-y-3">
            <div className="rounded-[1.35rem] border border-line/75 bg-white/66 px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Quiet state</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                No attention needed after tomorrow&apos;s prep unless the role framing changes again.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-accent-red/22 bg-[rgba(125,35,31,0.08)] px-4 py-4">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Protected context</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Personal family constraints are shaping her travel window this week.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">2. Next interaction</p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h3 className="section-title mt-0">Tomorrow, 8:30 AM board-prep pass</h3>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              This is worth surfacing because it is soon and it directly affects the company narrative for the week.
            </p>
          </div>
          <div className="rounded-full border border-line/75 bg-white/68 px-4 py-2 text-sm text-text-muted">
            Keep the conversation to role framing and board language
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">3. Open loops / commitments</p>
        <div className="mt-5 space-y-3">
          <OpenLoopRow
            title="Confirm the narrowed hiring brief language"
            owner="Will"
            due="Before board prep"
            note="She needs one crisp answer, not a long thread."
          />
          <OpenLoopRow
            title="Send the revised candidate framing after the meeting"
            owner="Chief of staff"
            due="Tomorrow"
            note="This is queued but does not need active attention until the prep conversation ends."
            quiet
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">4. Recent interactions</p>
        <div className="mt-5 space-y-3">
          <RecentInteractionRow
            date="Yesterday"
            title="Quick scope check over text"
            note="She flagged that the board draft was still assuming the broader version of the role."
          />
          <RecentInteractionRow
            date="Monday"
            title="Twenty-minute recruiting sync"
            note="Strong signal that she still wants a narrower, cleaner role narrative before externalizing anything."
          />
          <RecentInteractionRow
            date="Last week"
            title="Dinner follow-up"
            note="Personal tone was warm. Nothing from that exchange needs foreground attention right now."
          />
        </div>
      </section>

      <CollapsedPeopleSection
        eyebrow="Deeper layer"
        title="Longer horizon and relationship texture"
        summary="Collapsed by default so the page stays a brief first. Open only when more context is actually useful."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
            <p className="text-sm font-medium text-text">Relationship cadence</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Best in small, high-context conversations. Over-briefing by email tends to dilute clarity rather than improve it.
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] p-4">
            <p className="text-sm font-medium text-text">Longer horizon</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              If the hiring loop stabilizes this month, her attention should fall back into a quiet state with no special handling.
            </p>
          </div>
        </div>
      </CollapsedPeopleSection>
    </div>
  );
}
