import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BOOTSTRAP_USER_EMAIL = "local@chief-of-staff.app";

type InitiativeRecord = {
  id: string;
  why_now_title: string;
  why_now_summary: string;
  attention_state_note: string | null;
  summary_title: string;
  summary_body: string;
  risk_framing: string;
};

type InitiativeItemRecord = {
  section:
    | "risk_point"
    | "key_change"
    | "stakeholder"
    | "related_signal"
    | "open_loop"
    | "timeline_event"
    | "linked_artifact"
    | "goal_marker";
  label: string | null;
  title: string | null;
  body: string;
};

export type InitiativesPageData = {
  whyNowTitle: string;
  whyNowSummary: string;
  attentionStateNote: string | null;
  summaryTitle: string;
  summaryBody: string;
  riskFraming: string;
  riskPoints: string[];
  keyChanges: Array<{ date: string; title: string; note: string }>;
  stakeholders: Array<{ title: string; note: string }>;
  relatedSignals: string[];
  openLoops: Array<{ title: string; note: string }>;
  timelineEvents: Array<{ date: string; title: string; note: string }>;
  linkedArtifacts: Array<{ title: string; note: string }>;
  goalMarkers: string[];
};

async function createInitiativesReadClient() {
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    return adminClient;
  }

  return createSupabaseServerClient();
}

export async function getInitiativesPageData(): Promise<InitiativesPageData | null> {
  const client = await createInitiativesReadClient();
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

  const { data: initiative, error: initiativeError } = await client
    .from("initiatives")
    .select("id, why_now_title, why_now_summary, attention_state_note, summary_title, summary_body, risk_framing")
    .eq("user_id", bootstrapUser.id)
    .in("status", ["active", "quiet", "at_risk"])
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<InitiativeRecord>();

  if (initiativeError || !initiative) {
    return null;
  }

  const { data: items } = await client
    .from("initiative_items")
    .select("section, label, title, body")
    .eq("user_id", bootstrapUser.id)
    .eq("initiative_id", initiative.id)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .returns<InitiativeItemRecord[]>();

  const bySection = (section: InitiativeItemRecord["section"]) => (items ?? []).filter((item) => item.section === section);

  return {
    whyNowTitle: initiative.why_now_title,
    whyNowSummary: initiative.why_now_summary,
    attentionStateNote: initiative.attention_state_note,
    summaryTitle: initiative.summary_title,
    summaryBody: initiative.summary_body,
    riskFraming: initiative.risk_framing,
    riskPoints: bySection("risk_point").map((item) => item.body),
    keyChanges: bySection("key_change").map((item) => ({
      date: item.label ?? "Recent",
      title: item.title ?? "",
      note: item.body
    })),
    stakeholders: bySection("stakeholder").map((item) => ({
      title: item.title ?? "",
      note: item.body
    })),
    relatedSignals: bySection("related_signal").map((item) => item.body),
    openLoops: bySection("open_loop").map((item) => ({
      title: item.title ?? "",
      note: item.body
    })),
    timelineEvents: bySection("timeline_event").map((item) => ({
      date: item.label ?? "Recent",
      title: item.title ?? "",
      note: item.body
    })),
    linkedArtifacts: bySection("linked_artifact").map((item) => ({
      title: item.title ?? "",
      note: item.body
    })),
    goalMarkers: bySection("goal_marker").map((item) => item.body)
  };
}
