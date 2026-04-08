import {
  BellRing,
  BrainCircuit,
  MessageSquareText,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  UserRoundCog
} from "lucide-react";

import { AdminGroupCard } from "@/components/admin/admin-group-card";
import { MaterialChangeRow } from "@/components/admin/material-change-row";
import { RecommendedChangeCard } from "@/components/admin/recommended-change-card";
import { PageIntro } from "@/components/shell/page-intro";

const recommendedChanges = [
  {
    summary: "Tighten protected-context escalation for agent summaries.",
    impacts: "Agent Behavior, Privacy, and any communication summary that includes hybrid capture detail.",
    why: "The current posture is calm, but protected detail should step into escalation one beat earlier than open operational context."
  },
  {
    summary: "Move outbound communication defaults toward shorter executive drafts.",
    impacts: "Communications and the draft posture used after opening threads or follow-up notes.",
    why: "The system is already quiet enough on surfacing. The next gain is reducing over-written draft suggestions before they become noise."
  },
  {
    summary: "Simplify iPad navigation into a steadier default view order.",
    impacts: "Views & Navigation plus the way Admin, Inbox, and People are revisited during longer work sessions.",
    why: "The shell is structurally sound, but a calmer return path improves continuity when work moves across several screens."
  }
];

const primaryGroups = [
  {
    eyebrow: "1",
    title: "Agent Behavior",
    summary: "Controls how aggressively the system surfaces work, escalates protected context, and decides when no attention is needed now.",
    currentState: "Conservative by default. Suppression stays stronger than surfacing, and protected context remains earned.",
    note: "This group should feel like operating posture, not tuning every model knob.",
    icon: UserRoundCog
  },
  {
    eyebrow: "2",
    title: "Communications",
    summary: "Holds drafting posture, communication rhythm, and how outbound language stays concise across summaries, replies, and follow-ups.",
    currentState: "Drafting remains secondary to opening. Responses favor brief executive language over fully developed copy.",
    note: "Communication settings stay close to message quality and pacing, not channel analytics.",
    icon: MessageSquareText
  },
  {
    eyebrow: "3",
    title: "Privacy",
    summary: "Defines how open, protected, and hybrid context behaves across capture, summaries, and relationship or obligation views.",
    currentState: "Hybrid behavior is active. Corvette is reserved for protected moments, and sensitive context remains scoped.",
    note: "Privacy is presented as trust posture, not compliance theater or a dense permission matrix.",
    icon: ShieldCheck
  },
  {
    eyebrow: "4",
    title: "Views & Navigation",
    summary: "Shapes what appears first, what stays folded, and how the shell preserves continuity across iPhone, iPad, and Mac.",
    currentState: "The core shell is stable, with a strong bias toward minimal top layers and persistent capture access.",
    note: "This group governs calmness and access paths, not visual experimentation.",
    icon: PanelLeftOpen
  }
];

const secondaryGroups = [
  {
    eyebrow: "5",
    title: "Learning",
    summary: "Keeps track of what the system is allowed to retain as durable preference rather than ephemeral session detail.",
    currentState: "Only repeated, behavior-shaping patterns should graduate into learning. Incidental nudges should stay transient.",
    note: "Learning should remain narrow enough to feel helpful, not uncanny.",
    icon: BrainCircuit
  },
  {
    eyebrow: "6",
    title: "Devices & Notifications",
    summary: "Controls where attention reaches you and where the product stays deliberately quiet across devices.",
    currentState: "Notifications should remain low-volume and device-aware, with tray behavior used for material changes only.",
    note: "This group should feel manageable even on phone, not like a notification control tower.",
    icon: BellRing
  }
];

const materialHistory = [
  {
    changedAt: "Today",
    title: "Protected-context handling narrowed for hybrid capture review.",
    summary: "Material because it changes who can see sensitive supporting detail after capture, not just how the screen describes it."
  },
  {
    changedAt: "Yesterday",
    title: "Communication drafting defaults shortened.",
    summary: "Material because it changes the initial draft behavior across executive follow-ups and outbound replies."
  },
  {
    changedAt: "Last week",
    title: "Navigation posture set to keep backgrounded views folded by default.",
    summary: "Material because it changes where attention lands first when re-entering the product."
  }
];

export default function AdminPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Admin"
        title="Layered controls, kept calm enough to manage without turning into a systems console."
        description="Admin holds the product's operating posture: how agents behave, how communications stay concise, how privacy is protected, and how the shell stays manageable across devices."
      />

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Recommended changes</p>
            <h2 className="section-title mt-2 text-[1.35rem] md:text-[1.5rem]">
              Visible recommendations stay narrow: only changes that materially improve the operating posture should surface here.
            </h2>
            <p className="mt-3 max-w-[48rem] text-sm leading-6 text-text-muted md:text-base">
              Each recommendation is explicit about what it changes, where it reaches, and why it deserves attention now.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line/75 bg-white/75 px-4 py-2 text-sm text-text-muted">
            <Sparkles className="h-4 w-4 text-text-subtle" />
            {recommendedChanges.length} recommended changes
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {recommendedChanges.map((change) => (
            <RecommendedChangeCard
              key={change.summary}
              summary={change.summary}
              impacts={change.impacts}
              why={change.why}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Primary groups</p>
          <h2 className="section-title mt-2">The main operating controls stay broad, calm, and legible.</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            These are the groups that shape the product most directly, so they stay visible on the landing page instead of hiding behind deeper settings layers.
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {primaryGroups.map((group) => (
            <AdminGroupCard key={group.title} {...group} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Secondary groups</p>
          <h2 className="section-title mt-2">Learning and device behavior stay present, but quieter.</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            These controls matter, but they should not visually crowd the operating posture that executives manage most often.
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {secondaryGroups.map((group) => (
            <AdminGroupCard key={group.title} secondary {...group} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Material history</p>
          <h2 className="section-title mt-2">History stores only material changes.</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Copy polish, minor threshold tuning, and cosmetic tweaks stay out of this log. Only operating changes that alter behavior or trust posture belong here.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {materialHistory.map((change) => (
            <MaterialChangeRow
              key={`${change.changedAt}-${change.title}`}
              changedAt={change.changedAt}
              title={change.title}
              summary={change.summary}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
