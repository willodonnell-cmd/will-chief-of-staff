import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

type CommitmentRecord = {
  page_section: "detail" | "needs_attention" | "owed" | "at_risk" | "recent_changes" | "background" | null;
  title: string;
  summary: string;
  owner_type: "self" | "other";
  due_label: string | null;
  action_label: string | null;
  status: "open" | "quiet" | "at_risk" | "done" | "archived";
  why_it_matters: string | null;
  risk_note: string | null;
  stakeholders_note: string | null;
  next_step: string | null;
  linked_context: string | null;
  recent_history: string | null;
  protected_context: boolean;
};

type CommitmentListItem = {
  title: string;
  summary: string;
  due: string;
  owner: "you" | "others";
  action?: string;
  atRisk?: boolean;
};

export type CommitmentsPageData = {
  detail: {
    title: string;
    whyItMatters: string;
    status: string;
    risk: string;
    stakeholders: string;
    nextStep: string;
    linkedContext: string;
    recentHistory: string;
    protectedContext: boolean;
  } | null;
  needsAttention: CommitmentListItem[];
  whatIsOwed: CommitmentListItem[];
  atRisk: CommitmentListItem[];
  recentChanges: CommitmentListItem[];
  quietBackground: CommitmentListItem[];
};

function mapOwner(ownerType: CommitmentRecord["owner_type"]) {
  return ownerType === "self" ? "you" : "others";
}

function mapListItem(item: CommitmentRecord): CommitmentListItem {
  return {
    title: item.title,
    summary: item.summary,
    due: item.due_label ?? "Soon",
    owner: mapOwner(item.owner_type),
    action: item.action_label ?? undefined,
    atRisk: item.status === "at_risk"
  };
}

export async function getCommitmentsPageData(): Promise<CommitmentsPageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }
  const { client, user } = resolved;

  const { data: commitments, error: commitmentsError } = await client
    .from("commitments")
    .select(
      "page_section, title, summary, owner_type, due_label, action_label, status, why_it_matters, risk_note, stakeholders_note, next_step, linked_context, recent_history, protected_context"
    )
    .eq("user_id", user.id)
    .eq("scope", "general")
    .in("status", ["open", "quiet", "at_risk"])
    .order("sort_order", { ascending: true })
    .returns<CommitmentRecord[]>();

  if (commitmentsError || !commitments) {
    return null;
  }

  const bySection = (section: NonNullable<CommitmentRecord["page_section"]>) =>
    commitments.filter((item) => item.page_section === section);

  const detail = bySection("detail")[0] ?? null;

  return {
    detail: detail
      ? {
          title: detail.title,
          whyItMatters: detail.why_it_matters ?? detail.summary,
          status: detail.summary,
          risk: detail.risk_note ?? "No active risk note is available yet.",
          stakeholders: detail.stakeholders_note ?? "No stakeholder context is available yet.",
          nextStep: detail.next_step ?? "No next step is available yet.",
          linkedContext: detail.linked_context ?? "No linked context is available yet.",
          recentHistory: detail.recent_history ?? "No recent history is available yet.",
          protectedContext: detail.protected_context
        }
      : null,
    needsAttention: bySection("needs_attention").map(mapListItem),
    whatIsOwed: bySection("owed").map(mapListItem),
    atRisk: bySection("at_risk").map(mapListItem),
    recentChanges: bySection("recent_changes").map(mapListItem),
    quietBackground: bySection("background").map(mapListItem)
  };
}
