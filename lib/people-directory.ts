import type { PersonIndex } from "@/lib/people-search";
import type { Person } from "@/lib/person-vault";
import { resolveCurrentAppUser, type SupabaseReadClient } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

type PeopleListRow = {
  id: string;
  full_name: string;
  slug: string;
  organization: string | null;
  role_title: string | null;
  why_now_summary: string;
};

type PersonDetailRow = {
  id: string;
  full_name: string;
  organization: string | null;
  role_title: string | null;
  why_now_title: string;
  why_now_summary: string;
};

type CommitmentRow = {
  title: string;
  summary: string;
  owner_label: string | null;
  due_label: string | null;
  status: string;
  owner_type: string;
};

type SignalRow = {
  occurred_label: string | null;
  title: string;
  note: string;
};

const SEARCH_RESULT_LIMIT = 80;
const MAX_SEARCH_QUERY_CHARS = 120;
const CREATE_NAME_MIN = 2;
const CREATE_NAME_MAX = 200;
const CREATE_ORG_MAX = 200;

export type CreatePersonInput = {
  full_name: string;
  organization?: string | null;
};

export type CreatePersonResult =
  | { ok: true; person: PersonIndex }
  | { ok: false; error: string; code: "no_user" | "validation" | "db" | "slug" };

function slugifyPersonName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return base.length > 0 ? base : "person";
}

async function allocateUniquePeopleSlug(
  client: SupabaseReadClient,
  userId: string,
  base: string
): Promise<string | null> {
  let attempt = 0;
  let candidate = base;
  while (attempt < 12) {
    const { data: clash } = await withSupabaseTimeout(
      client
        .from("people")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", candidate)
        .maybeSingle()
    );
    if (!clash) return candidate;
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    candidate = `${base}-${suffix}`.slice(0, 96);
    attempt += 1;
  }
  return null;
}

export async function createPersonInVault(input: CreatePersonInput): Promise<CreatePersonResult> {
  const full_name = input.full_name.trim();
  if (full_name.length < CREATE_NAME_MIN || full_name.length > CREATE_NAME_MAX) {
    return {
      ok: false,
      error: `Name must be between ${CREATE_NAME_MIN} and ${CREATE_NAME_MAX} characters.`,
      code: "validation"
    };
  }

  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return { ok: false, error: "Not signed in or vault unavailable.", code: "no_user" };
  }

  const { client, user } = resolved;
  const orgRaw = input.organization?.trim() ?? "";
  if (orgRaw.length > CREATE_ORG_MAX) {
    return {
      ok: false,
      error: `Company must be at most ${CREATE_ORG_MAX} characters.`,
      code: "validation"
    };
  }
  const organization = orgRaw.length > 0 ? orgRaw : null;

  const slugBase = slugifyPersonName(full_name);
  const slug = await allocateUniquePeopleSlug(client, user.id, slugBase);
  if (!slug) {
    return { ok: false, error: "Could not allocate a unique URL slug.", code: "slug" };
  }

  const { data: maxSortRow } = await withSupabaseTimeout(
    client
      .from("people")
      .select("sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>()
  );

  const sort_order = (maxSortRow?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await withSupabaseTimeout(
    client
      .from("people")
      .insert({
        user_id: user.id,
        slug,
        full_name,
        organization,
        status: "active",
        importance: 2,
        why_now_title: "Current read pending",
        why_now_summary:
          "Add a current read when you have enough context. Until then, this person stays in a quiet starter state.",
        sort_order
      })
      .select("id, full_name, organization, role_title, why_now_summary")
      .single<
        Pick<PeopleListRow, "id" | "full_name" | "organization" | "role_title" | "why_now_summary">
      >()
  );

  if (error || !inserted) {
    return {
      ok: false,
      error: error?.message ?? "Could not create person.",
      code: "db"
    };
  }

  return {
    ok: true,
    person: {
      id: inserted.id,
      name: inserted.full_name,
      organization: inserted.organization ?? "",
      title: inserted.role_title ?? undefined,
      currentReadSnippet: inserted.why_now_summary
        ? inserted.why_now_summary.slice(0, 160)
        : undefined
    }
  };
}

/**
 * PostgREST `.or()` ilike value: wrap in double quotes; escape `"` as `""`.
 * User text is stripped of `%` / `_` so we control wildcards (substring match).
 */
function toQuotedIlikePattern(raw: string): string | null {
  const core = raw
    .trim()
    .slice(0, MAX_SEARCH_QUERY_CHARS)
    .replace(/[%_]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/"/g, "")
    .trim();
  if (!core) return null;
  const body = `%${core}%`.replace(/"/g, '""');
  return `"${body}"`;
}

function orIlikeColumns(pattern: string): string {
  const cols = ["full_name", "organization", "role_title", "why_now_summary", "slug"] as const;
  return cols.map((c) => `${c}.ilike.${pattern}`).join(",");
}

/** Server-side people search (no row cap on the table — DB applies ilike + limit). */
export async function searchPeopleIndexForCurrentUser(query: string): Promise<PersonIndex[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) return [];

  const quoted = toQuotedIlikePattern(query);
  if (!quoted) return [];

  const { data, error } = await withSupabaseTimeout(
    resolved.client
      .from("people")
      .select("id, full_name, slug, organization, role_title, why_now_summary")
      .eq("user_id", resolved.user.id)
      .in("status", ["active", "quiet"])
      .or(orIlikeColumns(quoted))
      .order("sort_order", { ascending: true })
      .limit(SEARCH_RESULT_LIMIT)
      .returns<PeopleListRow[]>()
  );

  if (error || !data?.length) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.full_name,
    organization: row.organization ?? "",
    title: row.role_title ?? undefined,
    currentReadSnippet: row.why_now_summary ? row.why_now_summary.slice(0, 160) : undefined
  }));
}

/** Full vault-shaped person for /people/[id] when id is a Supabase people row. */
export async function getPersonVaultFromDb(personId: string): Promise<Person | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) return null;

  const { client, user } = resolved;

  const { data: person, error: personError } = await withSupabaseTimeout(
    client
      .from("people")
      .select("id, full_name, organization, role_title, why_now_title, why_now_summary")
      .eq("user_id", user.id)
      .eq("id", personId)
      .in("status", ["active", "quiet"])
      .maybeSingle<PersonDetailRow>()
  );

  if (personError || !person) return null;

  const { data: commitments } = await withSupabaseTimeout(
    client
      .from("commitments")
      .select("title, summary, owner_label, due_label, status, owner_type")
      .eq("user_id", user.id)
      .eq("person_id", person.id)
      .in("status", ["open", "quiet", "at_risk"])
      .order("sort_order", { ascending: true })
      .limit(20)
      .returns<CommitmentRow[]>()
  );

  const { data: signals } = await withSupabaseTimeout(
    client
      .from("signals")
      .select("occurred_label, title, note")
      .eq("user_id", user.id)
      .eq("person_id", person.id)
      .eq("signal_type", "interaction")
      .order("occurred_at", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(25)
      .returns<SignalRow[]>()
  );

  const currentRead =
    [person.why_now_title?.trim(), person.why_now_summary?.trim()].filter(Boolean).join("\n\n") ||
    null;

  return {
    id: person.id,
    name: person.full_name,
    organization: person.organization ?? "",
    title: person.role_title ?? "",
    category: "internal",
    current_read: currentRead,
    open_loops: (commitments ?? []).map((c) => ({
      direction: c.owner_type === "self" ? ("i_owe" as const) : ("they_owe" as const),
      text: c.summary?.trim() ? `${c.title} — ${c.summary}` : c.title,
      by_when: c.due_label ?? undefined
    })),
    recent_interactions: (signals ?? []).map((s) => ({
      date: s.occurred_label ?? "Recent",
      context: s.title,
      what_changed: s.note
    })),
    last_researched: null,
    privacy: "business"
  };
}
