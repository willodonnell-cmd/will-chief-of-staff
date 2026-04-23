import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { listTodayTasks, type LibraryItemSummary } from "@/lib/capture-library";

type TodayBriefRecord = {
  id: string;
  high_focus_title: string;
  high_focus_summary: string;
  high_focus_owner: string;
  high_focus_timing: string;
  high_focus_decision: string;
  quiet_panel_eyebrow: string;
  quiet_panel_title: string;
};

type TodayGlanceItemRecord = {
  label: string;
  value: string;
  tone: "default" | "quiet" | "protected";
};

type TodayQuietItemRecord = {
  label: string;
  detail: string;
};

type TodaySupportNoteRecord = {
  eyebrow: string;
  title: string;
  body: string;
};

export type TodayPageData = {
  glanceItems: Array<{
    label: string;
    value: string;
    tone?: "default" | "quiet" | "protected";
  }>;
  highFocus: {
    title: string;
    summary: string;
    owner: string;
    timing: string;
    decision: string;
  } | null;
  quietPanel: {
    eyebrow: string;
    title: string;
    items: Array<{
      label: string;
      detail: string;
    }>;
  } | null;
  supportNotes: Array<{
    eyebrow: string;
    title: string;
    body: string;
  }>;
  taskSections: {
    overdue: Array<{
      id: string;
      title: string;
      detail: string;
      href: string;
    }>;
    dueSoon: Array<{
      id: string;
      title: string;
      detail: string;
      href: string;
    }>;
  };
};

function formatTaskTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function mapTodayTaskItem(item: LibraryItemSummary, kind: "overdue" | "dueSoon") {
  const timingLabel = item.dueAt
    ? kind === "overdue"
      ? `Overdue since ${formatTaskTimestamp(item.dueAt)}`
      : `Due ${formatTaskTimestamp(item.dueAt)}`
    : "No due date";
  const priorityLabel = item.task?.priority
    ? `${item.task.priority.slice(0, 1).toUpperCase()}${item.task.priority.slice(1)} priority`
    : null;

  return {
    id: item.id,
    title: item.title,
    detail: [timingLabel, priorityLabel].filter(Boolean).join(" · "),
    href: `/library/${item.id}?from=%2F`
  };
}

export async function getTodayPageData(): Promise<TodayPageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }
  const { client, user } = resolved;

  const { data: brief, error: briefError } = await client
    .from("today_briefs")
    .select(
      "id, high_focus_title, high_focus_summary, high_focus_owner, high_focus_timing, high_focus_decision, quiet_panel_eyebrow, quiet_panel_title"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<TodayBriefRecord>();

  if (briefError || !brief) {
    return null;
  }

  const [{ data: glanceItems }, { data: quietItems }, { data: supportNotes }] = await Promise.all([
    client
      .from("today_glance_items")
      .select("label, value, tone")
      .eq("user_id", user.id)
      .eq("today_brief_id", brief.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<TodayGlanceItemRecord[]>(),
    client
      .from("today_quiet_items")
      .select("label, detail")
      .eq("user_id", user.id)
      .eq("today_brief_id", brief.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<TodayQuietItemRecord[]>(),
    client
      .from("today_support_notes")
      .select("eyebrow, title, body")
      .eq("user_id", user.id)
      .eq("today_brief_id", brief.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<TodaySupportNoteRecord[]>()
  ]);

  const taskSections = await listTodayTasks();

  return {
    glanceItems: glanceItems ?? [],
    highFocus: {
      title: brief.high_focus_title,
      summary: brief.high_focus_summary,
      owner: brief.high_focus_owner,
      timing: brief.high_focus_timing,
      decision: brief.high_focus_decision
    },
    quietPanel: {
      eyebrow: brief.quiet_panel_eyebrow,
      title: brief.quiet_panel_title,
      items: quietItems ?? []
    },
    supportNotes: supportNotes ?? [],
    taskSections: {
      overdue: taskSections.overdue.map((item) => mapTodayTaskItem(item, "overdue")),
      dueSoon: taskSections.dueSoon.map((item) => mapTodayTaskItem(item, "dueSoon"))
    }
  };
}
