import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

type AdminRecommendationRecord = {
  summary: string;
  impacts: string;
  why: string;
};

type AdminGroupRecord = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  current_state: string;
  note: string;
};

type AdminMaterialChangeRecord = {
  changed_at_label: string;
  title: string;
  summary: string;
};

export type AdminSettingsPageData = {
  recommendedChanges: Array<{
    summary: string;
    impacts: string;
    why: string;
  }>;
  primaryGroups: Array<{
    slug: string;
    eyebrow: string;
    title: string;
    summary: string;
    currentState: string;
    note: string;
  }>;
  secondaryGroups: Array<{
    slug: string;
    eyebrow: string;
    title: string;
    summary: string;
    currentState: string;
    note: string;
  }>;
  materialHistory: Array<{
    changedAt: string;
    title: string;
    summary: string;
  }>;
};

export async function getAdminSettingsPageData(): Promise<AdminSettingsPageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }
  const { client, user } = resolved;

  const [{ data: recommendations }, { data: groups }, { data: history }] = await Promise.all([
    client
      .from("admin_recommendations")
      .select("summary, impacts, why")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<AdminRecommendationRecord[]>(),
    client
      .from("admin_setting_groups")
      .select("slug, eyebrow, title, summary, current_state, note, tier")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    client
      .from("admin_material_changes")
      .select("changed_at_label, title, summary")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<AdminMaterialChangeRecord[]>()
  ]);

  const typedGroups = (groups ?? []) as Array<AdminGroupRecord & { tier: "primary" | "secondary" }>;

  return {
    recommendedChanges: (recommendations ?? []).map((item) => ({
      summary: item.summary,
      impacts: item.impacts,
      why: item.why
    })),
    primaryGroups: typedGroups
      .filter((group) => group.tier === "primary")
      .map((group) => ({
        slug: group.slug,
        eyebrow: group.eyebrow,
        title: group.title,
        summary: group.summary,
        currentState: group.current_state,
        note: group.note
      })),
    secondaryGroups: typedGroups
      .filter((group) => group.tier === "secondary")
      .map((group) => ({
        slug: group.slug,
        eyebrow: group.eyebrow,
        title: group.title,
        summary: group.summary,
        currentState: group.current_state,
        note: group.note
      })),
    materialHistory: (history ?? []).map((item) => ({
      changedAt: item.changed_at_label,
      title: item.title,
      summary: item.summary
    }))
  };
}
