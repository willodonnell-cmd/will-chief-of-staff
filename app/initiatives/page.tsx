import { BriefCard } from "@/components/shell/brief-card";
import { PageIntro } from "@/components/shell/page-intro";

export default function InitiativesPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Initiatives"
        title="Strategic briefs first."
        description="Initiatives are positioned for narrative clarity, with space for milestones, risks, owners, and next decisions inside the light content plane."
      />
      <BriefCard
        eyebrow="Shell behavior"
        title="Architecture around the work, not over it."
        body="The dark sidebar establishes orientation while the content plane handles the evolving brief. That keeps the shell stable as this area grows into richer planning workflows."
      />
    </div>
  );
}

