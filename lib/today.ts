import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BOOTSTRAP_USER_EMAIL = "local@chief-of-staff.app";

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
};

async function createTodayReadClient() {
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    return adminClient;
  }

  return createSupabaseServerClient();
}

export async function getTodayPageData(): Promise<TodayPageData | null> {
  const client = await createTodayReadClient();
  if (!client) {
    return null;
  }

  const { data: bootstrapUser, error: userError } = await client
    .from("users")
    .select("id")
    .eq("email", BOOTSTRAP_USER_EMAIL)
    .maybeSingle();

  if (userError || !bootstrapUser) {
    return null;
  }

  const { data: brief, error: briefError } = await client
    .from("today_briefs")
    .select(
      "id, high_focus_title, high_focus_summary, high_focus_owner, high_focus_timing, high_focus_decision, quiet_panel_eyebrow, quiet_panel_title"
    )
    .eq("user_id", bootstrapUser.id)
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
      .eq("user_id", bootstrapUser.id)
      .eq("today_brief_id", brief.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<TodayGlanceItemRecord[]>(),
    client
      .from("today_quiet_items")
      .select("label, detail")
      .eq("user_id", bootstrapUser.id)
      .eq("today_brief_id", brief.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<TodayQuietItemRecord[]>(),
    client
      .from("today_support_notes")
      .select("eyebrow, title, body")
      .eq("user_id", bootstrapUser.id)
      .eq("today_brief_id", brief.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<TodaySupportNoteRecord[]>()
  ]);

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
    supportNotes: supportNotes ?? []
  };
}
