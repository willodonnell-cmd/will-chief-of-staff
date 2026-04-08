import { BriefCard } from "@/components/shell/brief-card";
import { PageIntro } from "@/components/shell/page-intro";

export default function CommitmentsPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Commitments"
        title="Obligation briefs first."
        description="Commitments have a dedicated large-screen destination so obligations can stay legible and quiet instead of competing with inbox urgency."
      />
      <BriefCard
        eyebrow="Platform note"
        title="Desktop expands the shell without splitting the product."
        body="The web app adapts from a 5-item iPhone bottom nav to an iPad and Mac sidebar, keeping one codebase and one design system as the product matures."
      />
    </div>
  );
}

