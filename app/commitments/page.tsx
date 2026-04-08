import { CollapsedCommitmentSection } from "@/components/commitments/collapsed-commitment-section";
import { CommitmentDetailCard } from "@/components/commitments/commitment-detail-card";
import { CommitmentSection } from "@/components/commitments/commitment-section";
import { PageIntro } from "@/components/shell/page-intro";

const needsAttention = [
  {
    title: "Board packet narrative revision",
    summary: "A concise framing update is owed before tomorrow morning so the packet stops reflecting the outdated hiring scope.",
    due: "Before 8:30 AM",
    owner: "you" as const,
    action: "Open"
  },
  {
    title: "Confirm candidate-language update from recruiting",
    summary: "Recruiting owes a final wording check, but it only needs to be surfaced because it blocks your outgoing note.",
    due: "Today",
    owner: "others" as const,
    action: "Open"
  }
];

const whatIsOwed = [
  {
    title: "You owe the revised board note",
    summary: "Short written alignment after the prep pass.",
    due: "Tomorrow",
    owner: "you" as const
  },
  {
    title: "Legal owes the compensation language review",
    summary: "Needed before the scenario can be shared more broadly.",
    due: "This week",
    owner: "others" as const
  }
];

const atRisk = [
  {
    title: "Candidate expectation reset",
    summary: "Timing is tightening. If the message slips again, the tone of the search may shift unnecessarily.",
    due: "Soon",
    owner: "you" as const,
    atRisk: true
  }
];

const recentChanges = [
  {
    title: "Hiring-brief commitment narrowed",
    summary: "The obligation is smaller now, but more time-sensitive because it directly feeds the board packet.",
    due: "Today",
    owner: "you" as const
  },
  {
    title: "Legal review moved one day",
    summary: "The slip is manageable and does not need foreground attention unless finance also moves.",
    due: "Yesterday",
    owner: "others" as const
  }
];

const quietBackground = [
  {
    title: "Investor recap follow-up",
    summary: "Still backgrounded. No additional action is needed until the meeting notes finalize.",
    due: "Next week",
    owner: "you" as const
  }
];

export default function CommitmentsPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Commitments"
        title="Obligation brief first, with backgrounded items mostly out of sight."
        description="This screen keeps the top layer narrow: what actually needs attention, who owes what, what is at risk, and only the most relevant recent movement."
      />

      <CommitmentDetailCard
        title="Board packet narrative revision"
        whyItMatters="This commitment matters because it is the clearest obligation tying hiring, finance, and board prep together. If it lands cleanly, several smaller follow-ups stay quiet."
        status="Open and active. Moderate risk if it slips past the morning prep window."
        risk="The risk is timing, not uncertainty. The work is understood; the obligation just needs a short, clean close."
        stakeholders="Amelia Hart, finance, and recruiting all depend on the updated framing staying consistent across their materials."
        nextStep="Send the revised narrative language immediately after tomorrow's prep pass."
        linkedContext="Linked to the board-prep meeting, the recruiting thread, and the executive operating rhythm initiative."
        recentHistory="Yesterday the commitment narrowed from a broader hiring brief rewrite to one focused narrative correction. That lowered scope but increased immediacy."
        protectedContext
      />

      <CommitmentSection
        eyebrow="1"
        title="What needs attention now"
        description="Only the obligations that seem active enough to deserve foreground attention right now."
        items={needsAttention}
      />

      <CommitmentSection
        eyebrow="2"
        title="What you owe vs what others owe"
        description="A split view of obligations so the page clarifies ownership before it amplifies urgency."
        items={whatIsOwed}
      />

      <CommitmentSection
        eyebrow="3"
        title="At-risk commitments"
        description="A very small list of commitments whose timing or dependency chain may be slipping."
        items={atRisk}
      />

      <CommitmentSection
        eyebrow="4"
        title="Recent changes"
        description="Recent shifts in commitment shape or timing, kept brief and non-focal."
        items={recentChanges}
      />

      <CollapsedCommitmentSection
        eyebrow="Quiet background"
        title="Backgrounded commitments"
        summary="Expanded only when useful. Most lower-priority obligations should stay out of sight."
      >
        <div className="space-y-3">
          {quietBackground.map((item) => (
            <div
              key={`${item.title}-${item.due}`}
              className="rounded-[1.35rem] border border-accent-moss/18 bg-[rgba(104,118,86,0.08)] px-4 py-4"
            >
              <p className="text-sm font-medium text-text">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p>
            </div>
          ))}
        </div>
      </CollapsedCommitmentSection>
    </div>
  );
}
