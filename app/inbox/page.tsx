import { BriefCard } from "@/components/shell/brief-card";
import { PageIntro } from "@/components/shell/page-intro";

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Priority Inbox"
        title="Triage first."
        description="Inbox is reserved for active sorting and decision-making, with the shell keeping the environment quiet enough for fast judgment."
      />
      <BriefCard
        eyebrow="Queue"
        title="List views stay focused on disposition."
        body="This first pass intentionally avoids drafting affordances in the shell. The next layer can add triage states, sender context, and relationship cues."
      />
    </div>
  );
}

