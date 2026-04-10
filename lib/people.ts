import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

type PersonRecord = {
  id: string;
  full_name: string;
  why_now_title: string;
  why_now_summary: string;
  quiet_state_note: string | null;
  protected_context: string | null;
  next_interaction_title: string | null;
  next_interaction_note: string | null;
  next_interaction_guidance: string | null;
  cadence_note: string | null;
  horizon_note: string | null;
};

type CommitmentRecord = {
  title: string;
  summary: string;
  owner_label: string | null;
  due_label: string | null;
  status: string;
};

type SignalRecord = {
  occurred_label: string | null;
  title: string;
  note: string;
};

type BriefingRecord = {
  title: string;
  body: string;
};

export type PeoplePageData = {
  currentReadTitle: string;
  currentReadBody: string;
  quietStateNote: string | null;
  protectedContext: string | null;
  nextInteractionTitle: string | null;
  nextInteractionNote: string | null;
  nextInteractionGuidance: string | null;
  openLoops: Array<{
    title: string;
    owner: string;
    due: string;
    note: string;
    quiet: boolean;
  }>;
  recentInteractions: Array<{
    date: string;
    title: string;
    note: string;
  }>;
  deeperLayer: Array<{
    title: string;
    body: string;
  }>;
};

export async function getPeoplePageData(): Promise<PeoplePageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }
  const { client, user } = resolved;

  const { data: person, error: personError } = await client
    .from("people")
    .select(
      "id, full_name, why_now_title, why_now_summary, quiet_state_note, protected_context, next_interaction_title, next_interaction_note, next_interaction_guidance, cadence_note, horizon_note"
    )
    .eq("user_id", user.id)
    .in("status", ["active", "quiet"])
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<PersonRecord>();

  if (personError || !person) {
    return null;
  }

  const [{ data: commitments }, { data: signals }, { data: briefings }] = await Promise.all([
    client
      .from("commitments")
      .select("title, summary, owner_label, due_label, status")
      .eq("user_id", user.id)
      .eq("person_id", person.id)
      .in("status", ["open", "quiet", "at_risk"])
      .order("sort_order", { ascending: true })
      .limit(4)
      .returns<CommitmentRecord[]>(),
    client
      .from("signals")
      .select("occurred_label, title, note")
      .eq("user_id", user.id)
      .eq("person_id", person.id)
      .eq("signal_type", "interaction")
      .order("occurred_at", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(3)
      .returns<SignalRecord[]>(),
    client
      .from("briefings")
      .select("title, body")
      .eq("user_id", user.id)
      .eq("person_id", person.id)
      .eq("kind", "detail")
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .returns<BriefingRecord[]>()
  ]);

  return {
    currentReadTitle: person.why_now_title,
    currentReadBody: person.why_now_summary,
    quietStateNote: person.quiet_state_note,
    protectedContext: person.protected_context,
    nextInteractionTitle: person.next_interaction_title,
    nextInteractionNote: person.next_interaction_note,
    nextInteractionGuidance: person.next_interaction_guidance,
    openLoops: (commitments ?? []).map((item) => ({
      title: item.title,
      owner: item.owner_label ?? (item.status === "quiet" ? "Chief of staff" : "Will"),
      due: item.due_label ?? "Soon",
      note: item.summary,
      quiet: item.status === "quiet"
    })),
    recentInteractions: (signals ?? []).map((item) => ({
      date: item.occurred_label ?? "Recent",
      title: item.title,
      note: item.note
    })),
    deeperLayer:
      briefings && briefings.length > 0
        ? briefings.map((item) => ({
            title: item.title,
            body: item.body
          }))
        : [
            {
              title: "Relationship cadence",
              body: person.cadence_note ?? "No cadence note available yet."
            },
            {
              title: "Longer horizon",
              body: person.horizon_note ?? "No horizon note available yet."
            }
          ]
  };
}
