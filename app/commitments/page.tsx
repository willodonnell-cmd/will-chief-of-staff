import { CollapsedCommitmentSection } from "@/components/commitments/collapsed-commitment-section";
import { CommitmentDetailCard } from "@/components/commitments/commitment-detail-card";
import { CommitmentRow } from "@/components/commitments/commitment-row";
import { CommitmentSection } from "@/components/commitments/commitment-section";
import { PageIntro } from "@/components/shell/page-intro";
import { getCommitmentsPageData } from "@/lib/commitments";

export default async function CommitmentsPage() {
  const commitmentsData = await getCommitmentsPageData();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Commitments"
        title="Canonical obligations, grouped for operational follow-through."
        description="Commitments is a distinct surface over existing Library task objects: overdue work first, near-term due dates next, active undated obligations after that, and recent completions kept quiet."
      />

      {commitmentsData.overview ? (
        <CommitmentDetailCard
          title={commitmentsData.overview.title}
          summary={commitmentsData.overview.summary}
          href={commitmentsData.overview.href}
          stateLabel={commitmentsData.overview.stateLabel}
          timingLabel={commitmentsData.overview.timingLabel}
          activityLabel={commitmentsData.overview.activityLabel}
          priorityLabel={commitmentsData.overview.priorityLabel}
          posture={commitmentsData.overview.posture}
          sourceNote={commitmentsData.overview.sourceNote}
          metrics={commitmentsData.overview.metrics}
        />
      ) : (
        <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Commitments brief</p>
          <h2 className="brief-title">No canonical task commitments are surfaced yet.</h2>
          <p className="brief-body">
            Once Library tasks exist, this page will group those same canonical objects into an obligation view without copying them into a second store.
          </p>
        </section>
      )}

      <CommitmentSection
        eyebrow="1"
        title="Overdue"
        description="Obligations whose due dates have already slipped. These stay first because recovery order matters more than chronology."
        items={commitmentsData.sections.overdue}
        emptyMessage="No overdue commitments are currently surfaced."
      />

      <CommitmentSection
        eyebrow="2"
        title="Due soon"
        description="Active commitments due inside the next 72 hours, sorted by due time first and recent activity second."
        items={commitmentsData.sections.dueSoon}
        emptyMessage="Nothing is due inside the next 72 hours."
      />

      <CommitmentSection
        eyebrow="3"
        title="Active, no due date"
        description="Live obligations without a date yet, ordered by priority and then by most recent movement."
        items={commitmentsData.sections.activeNoDue}
        emptyMessage="No active undated commitments are currently surfaced."
      />

      <CollapsedCommitmentSection
        eyebrow="Background"
        title="Later-dated commitments"
        summary="These commitments have dates, but not inside the near-term window, so they stay available without competing for the top layer."
      >
        <div className="space-y-3">
          {commitmentsData.sections.upcomingLater.length > 0 ? (
            commitmentsData.sections.upcomingLater.map((item) => <CommitmentRow key={item.id} {...item} />)
          ) : (
            <div className="rounded-[1.35rem] border border-line/65 bg-[rgba(255,255,255,0.48)] px-4 py-4 text-sm leading-6 text-text-muted">
              No later-dated commitments are currently surfaced.
            </div>
          )}
        </div>
      </CollapsedCommitmentSection>

      <CollapsedCommitmentSection
        eyebrow="Completed"
        title="Recently completed"
        summary="Closed commitments remain reachable, but they stay deemphasized so active obligations can lead."
      >
        <div className="space-y-3">
          {commitmentsData.sections.completed.length > 0 ? (
            commitmentsData.sections.completed.map((item) => <CommitmentRow key={item.id} {...item} />)
          ) : (
            <div className="rounded-[1.35rem] border border-line/65 bg-[rgba(255,255,255,0.48)] px-4 py-4 text-sm leading-6 text-text-muted">
              No recent completed commitments are currently surfaced.
            </div>
          )}
        </div>
      </CollapsedCommitmentSection>
    </div>
  );
}
