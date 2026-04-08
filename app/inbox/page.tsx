import { InboxSection } from "@/components/inbox/inbox-section";
import { PageIntro } from "@/components/shell/page-intro";

const needsAttention = [
  {
    sender: "Amelia Hart",
    subject: "Board packet scope changed after the hiring brief revision",
    preview: "Finance aligned the numbers, but the narrative still assumes the broader role. This likely needs one executive decision today.",
    received: "18m ago",
    action: "Open",
    elevated: true
  },
  {
    sender: "Jordan Lee",
    subject: "Partner intro request for tomorrow's calendar",
    preview: "A short answer should either confirm the intro or push it a week without opening a longer thread.",
    received: "42m ago",
    action: "Open"
  }
];

const possibleMisses = [
  {
    sender: "Mina Chen",
    subject: "Following up on next steps from Friday",
    preview: "The tone is still warm, but the thread is aging enough that it may deserve a quick read.",
    received: "Yesterday",
    action: "Open"
  },
  {
    sender: "Alex Romero",
    subject: "Quick check-in before your trip",
    preview: "Not urgent on its face, but easy to overlook if it slips one more day.",
    received: "Yesterday",
    action: "Open"
  }
];

const priorityThreads = [
  {
    sender: "Chief of Staff",
    subject: "Hiring loop narrowing",
    preview: "Working thread tied to the board packet and recruiting alignment.",
    received: "Live",
    action: "Open"
  },
  {
    sender: "Nora Patel",
    subject: "Private family logistics note",
    preview: "Protected context is attached, so the thread stays surfaced without exposing the detail in the list.",
    received: "Today",
    action: "Open",
    protectedThread: true
  },
  {
    sender: "Finance + Legal",
    subject: "Compensation scenario follow-up",
    preview: "Background thread worth keeping in reach, but not ahead of the top two sections.",
    received: "Today",
    action: "Open"
  }
];

export default function InboxPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Priority Inbox"
        title="Triage-first, with a strong bias toward tight sections."
        description="Priority Inbox surfaces only what seems worth executive attention now. Cold outreach stays out by default, rows stay compact, and each thread gets one primary action."
      />

      <div className="space-y-4 lg:space-y-5">
        <InboxSection
          eyebrow="1"
          title="Needs Attention"
          description="The narrowest set of threads that appear to need action now. One elevated item is used only where the current signal is clearly stronger."
          items={needsAttention}
        />

        <InboxSection
          eyebrow="2"
          title="Possible Misses"
          description="A small catch-up section for threads that may be drifting, without forcing them into the top tier."
          items={possibleMisses}
        />

        <InboxSection
          eyebrow="3"
          title="Priority Threads"
          description="Important working threads kept within reach, including protected threads when context warrants it."
          items={priorityThreads}
        />
      </div>
    </div>
  );
}
