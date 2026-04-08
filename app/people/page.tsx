import { BriefCard } from "@/components/shell/brief-card";
import { PageIntro } from "@/components/shell/page-intro";

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="People"
        title="Relationship briefs first."
        description="People pages are framed as durable context rather than noisy activity streams, supporting executive prep and thoughtful follow-through."
      />
      <BriefCard
        eyebrow="Design note"
        title="Hierarchy over contrast."
        body="The shell relies on spacing, type scale, and card grouping so people context can expand without turning into a dashboard of alerts."
      />
    </div>
  );
}

