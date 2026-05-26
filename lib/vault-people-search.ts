import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { VaultExcerpt } from "@/lib/obsidian-search";

const MAX_RESULTS = 5;
const SNIPPET_BEFORE = 150;
const SNIPPET_AFTER = 300;

function extractSnippet(content: string, name: string): string {
  const lower = content.toLowerCase();
  const idx = lower.indexOf(name.toLowerCase());
  if (idx === -1) return content.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER).trim();
  const start = Math.max(0, idx - SNIPPET_BEFORE);
  const end = Math.min(content.length, idx + SNIPPET_AFTER);
  return content.slice(start, end).trim();
}

/**
 * Search vault_people in Supabase for mentions of a person's name.
 * Used in production where the local vault filesystem is not accessible.
 */
export async function searchSupabaseVaultPeople(name: string): Promise<VaultExcerpt[]> {
  const client = createSupabaseAdminClient();
  if (!client || !name.trim()) return [];

  // Build a plain-text tsquery: "Scott Marshall" → "Scott & Marshall"
  const tsquery = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" & ");

  const { data, error } = await client
    .from("vault_people")
    .select("slug, name, content")
    .textSearch("search_vector", tsquery, { type: "plain" })
    .limit(MAX_RESULTS);

  if (error || !data) return [];

  return data.map((row) => ({
    source: "notes" as const,
    file: `people/${row.slug}.md`,
    excerpt: extractSnippet(row.content as string, name)
  }));
}
