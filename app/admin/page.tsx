import {
  BellRing,
  BrainCircuit,
  MessageSquareText,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  UserRoundCog
} from "lucide-react";

import {
  createTaskCategoryAction,
  deactivateTaskCategoryAction,
  moveTaskCategoryDownAction,
  moveTaskCategoryUpAction,
  renameTaskCategoryAction,
  updateTaskCaptureSettingsAction
} from "@/app/admin/actions";
import { AdminGroupCard } from "@/components/admin/admin-group-card";
import { MaterialChangeRow } from "@/components/admin/material-change-row";
import { RecommendedChangeCard } from "@/components/admin/recommended-change-card";
import { PageIntro } from "@/components/shell/page-intro";
import { getAdminSettingsPageData } from "@/lib/admin-settings";
import { getTaskConfig } from "@/lib/task-config";

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
    slug: "agent-behavior",
    eyebrow: "1",
    title: "Agent Behavior",
    summary: "Controls how aggressively the system surfaces work, escalates protected context, and decides when no attention is needed now.",
    currentState: "Conservative by default. Suppression stays stronger than surfacing, and protected context remains earned.",
    note: "This group should feel like operating posture, not tuning every model knob.",
    icon: UserRoundCog
  },
  {
    slug: "communications",
    eyebrow: "2",
    title: "Communications",
    summary: "Holds drafting posture, communication rhythm, and how outbound language stays concise across summaries, replies, and follow-ups.",
    currentState: "Drafting remains secondary to opening. Responses favor brief executive language over fully developed copy.",
    note: "Communication settings stay close to message quality and pacing, not channel analytics.",
    icon: MessageSquareText
  },
  {
    slug: "privacy",
    eyebrow: "3",
    title: "Privacy",
    summary: "Defines how open, protected, and hybrid context behaves across capture, summaries, and relationship or obligation views.",
    currentState: "Hybrid behavior is active. Corvette is reserved for protected moments, and sensitive context remains scoped.",
    note: "Privacy is presented as trust posture, not compliance theater or a dense permission matrix.",
    icon: ShieldCheck
  },
  {
    slug: "views-navigation",
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
    slug: "learning",
    eyebrow: "5",
    title: "Learning",
    summary: "Keeps track of what the system is allowed to retain as durable preference rather than ephemeral session detail.",
    currentState: "Only repeated, behavior-shaping patterns should graduate into learning. Incidental nudges should stay transient.",
    note: "Learning should remain narrow enough to feel helpful, not uncanny.",
    icon: BrainCircuit
  },
  {
    slug: "devices-notifications",
    eyebrow: "6",
    title: "Devices & Notifications",
    summary: "Controls where attention reaches you and where the product stays deliberately quiet across devices.",
    currentState: "Notifications should remain low-volume and device-aware, with tray behavior used for material changes only.",
    note: "This group should feel manageable even on phone, not like a notification control tower.",
    icon: BellRing
  }
];

const adminGroupIcons = {
  "agent-behavior": UserRoundCog,
  communications: MessageSquareText,
  privacy: ShieldCheck,
  "views-navigation": PanelLeftOpen,
  learning: BrainCircuit,
  "devices-notifications": BellRing
} as const;

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

export default async function AdminPage() {
  const [adminData, taskConfig] = await Promise.all([getAdminSettingsPageData(), getTaskConfig()]);

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
            {(adminData?.recommendedChanges ?? recommendedChanges).length} recommended changes
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {(adminData?.recommendedChanges ?? recommendedChanges).map((change) => (
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
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Task capture</p>
          <h2 className="section-title mt-2">Control task density without turning convenience toggles into admin clutter.</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            These controls govern the operational task model directly: category taxonomy and whether Next Step or Desired Outcome start expanded in task capture.
          </p>
        </div>

        <form action={updateTaskCaptureSettingsAction} className="mt-6 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Default expansion</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-[1rem] border border-line/70 bg-white/70 px-4 py-3 text-sm text-text">
              <input
                type="checkbox"
                name="expandNextStepByDefault"
                defaultChecked={taskConfig.captureSettings.expandNextStepByDefault}
                className="h-4 w-4"
              />
              Expand Next Step by default
            </label>
            <label className="flex items-center gap-3 rounded-[1rem] border border-line/70 bg-white/70 px-4 py-3 text-sm text-text">
              <input
                type="checkbox"
                name="expandDesiredOutcomeByDefault"
                defaultChecked={taskConfig.captureSettings.expandDesiredOutcomeByDefault}
                className="h-4 w-4"
              />
              Expand Desired Outcome by default
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
              Save capture defaults
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Task categories</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Categories can be added, renamed, reordered, and deactivated. The fallback TBD category stays protected so every task always retains a safe category value.
              </p>
            </div>
            <form action={createTaskCategoryAction} className="flex w-full max-w-md gap-2">
              <input
                name="name"
                placeholder="Add a new category"
                className="min-w-0 flex-1 rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none"
              />
              <button type="submit" className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white">
                Add
              </button>
            </form>
          </div>

          <div className="mt-5 space-y-3">
            {taskConfig.categories.map((category) => (
              <div key={category.id} className="rounded-[1.1rem] border border-line/70 bg-white/72 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <form action={renameTaskCategoryAction} className="flex min-w-0 flex-1 gap-2">
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input
                      name="name"
                      defaultValue={category.name}
                      disabled={category.isFallback}
                      className="min-w-0 flex-1 rounded-[1rem] border border-line/75 bg-white/82 px-4 py-3 text-sm text-text outline-none disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={category.isFallback}
                      className="rounded-full border border-line/80 bg-white/84 px-4 py-2.5 text-sm font-medium text-text transition hover:bg-white disabled:opacity-60"
                    >
                      Rename
                    </button>
                  </form>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={moveTaskCategoryUpAction}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-3 py-2 text-sm text-text transition hover:bg-white">
                        Up
                      </button>
                    </form>
                    <form action={moveTaskCategoryDownAction}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button type="submit" className="rounded-full border border-line/75 bg-white/82 px-3 py-2 text-sm text-text transition hover:bg-white">
                        Down
                      </button>
                    </form>
                    <form action={deactivateTaskCategoryAction}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <button
                        type="submit"
                        disabled={category.isFallback || category.status === "inactive"}
                        className="rounded-full border border-line/75 bg-white/82 px-3 py-2 text-sm text-text transition hover:bg-white disabled:opacity-60"
                      >
                        {category.status === "inactive" ? "Inactive" : "Deactivate"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
          {(adminData?.primaryGroups ?? primaryGroups).map((group) => (
            <AdminGroupCard
              key={group.title}
              eyebrow={group.eyebrow}
              title={group.title}
              summary={group.summary}
              currentState={group.currentState}
              note={group.note}
              icon={adminGroupIcons[group.slug as keyof typeof adminGroupIcons]}
            />
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
          {(adminData?.secondaryGroups ?? secondaryGroups).map((group) => (
            <AdminGroupCard
              key={group.title}
              eyebrow={group.eyebrow}
              title={group.title}
              summary={group.summary}
              currentState={group.currentState}
              note={group.note}
              icon={adminGroupIcons[group.slug as keyof typeof adminGroupIcons]}
              secondary
            />
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
          {(adminData?.materialHistory ?? materialHistory).map((change) => (
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
