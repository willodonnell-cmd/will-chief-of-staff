import { promises as fs } from "fs";
import path from "path";
import { searchSupabaseVaultPeople } from "@/lib/vault-people-search";

export type VaultSource = "email" | "plaud" | "teams" | "notes";

export type VaultExcerpt = {
  source: VaultSource;
  file: string; // relative path from vault root, shown as display label
  excerpt: string; // ±CONTEXT_LINES lines around each name match
};

export type VaultSourceResults = Record<VaultSource, VaultExcerpt[]>;

/** Maps each source tab to the vault subdirectories to search. */
const SOURCE_DIRS: Record<VaultSource, string[]> = {
  email: ["raw/email", "raw/emails"],
  plaud: ["raw/plaud"],
  teams: ["raw/chat"],
  notes: ["cos/people", "cos/companies", "people"]
};

const MAX_PER_SOURCE = 5;
const CONTEXT_LINES = 3;

async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...(await walkMarkdown(full)));
      } else if (entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  } catch {
    // Directory missing or unreadable — skip silently
  }
  return out;
}

function extractExcerpts(content: string, name: string): string[] {
  const lines = content.split("\n");
  const q = name.toLowerCase();
  const hits: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(q)) {
      const start = Math.max(0, i - CONTEXT_LINES);
      const end = Math.min(lines.length - 1, i + CONTEXT_LINES);
      hits.push(lines.slice(start, end + 1).join("\n").trim());
    }
  }
  return hits;
}

/**
 * Search the Obsidian vault for mentions of a person's name.
 *
 * - Local (OBSIDIAN_VAULT_PATH set): walks the filesystem across all sources.
 * - Production (no vault path): queries Supabase vault_people for notes only;
 *   raw email/plaud/teams are local-only and not returned.
 */
export async function searchVaultForPerson(name: string): Promise<VaultExcerpt[]> {
  if (!name.trim()) return [];

  const vaultPath = process.env.OBSIDIAN_VAULT_PATH?.trim();

  // Production: no local vault — fall back to Supabase for people profiles
  if (!vaultPath) {
    return searchSupabaseVaultPeople(name);
  }

  const results: VaultExcerpt[] = [];

  for (const [src, dirs] of Object.entries(SOURCE_DIRS) as [VaultSource, string[]][]) {
    let count = 0;
    for (const dir of dirs) {
      if (count >= MAX_PER_SOURCE) break;
      const files = await walkMarkdown(path.join(vaultPath, dir));
      for (const file of files) {
        if (count >= MAX_PER_SOURCE) break;
        try {
          const content = await fs.readFile(file, "utf-8");
          const hits = extractExcerpts(content, name);
          if (hits.length > 0) {
            results.push({
              source: src,
              file: path.relative(vaultPath, file),
              excerpt: hits[0] // first match per file
            });
            count++;
          }
        } catch {
          // Unreadable file — skip
        }
      }
    }
  }

  return results;
}

export function groupVaultResults(excerpts: VaultExcerpt[]): VaultSourceResults {
  return {
    email: excerpts.filter((e) => e.source === "email"),
    plaud: excerpts.filter((e) => e.source === "plaud"),
    teams: excerpts.filter((e) => e.source === "teams"),
    notes: excerpts.filter((e) => e.source === "notes")
  };
}
