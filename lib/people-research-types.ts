import type { VaultSourceResults } from "@/lib/obsidian-search";

export type { VaultSource, VaultExcerpt, VaultSourceResults } from "@/lib/obsidian-search";

export type ResearchPayload = {
  current_role: { text: string; source: string };
  recent_news: Array<{ headline: string; text: string; source: string; date: string }>;
  writing: Array<{ title: string; platform: string; date: string }>;
  network: Array<{ connection: string; context: string }>;
  suggested_read_update: string | null;
  vault_results?: VaultSourceResults;
};

export function isResearchPayloadEmpty(data: ResearchPayload): boolean {
  const roleEmpty = !data.current_role?.text?.trim();
  const newsEmpty = !data.recent_news?.length;
  const writingEmpty = !data.writing?.length;
  const netEmpty = !data.network?.length;
  // vault_results absence does not count as empty — web results determine this
  return roleEmpty && newsEmpty && writingEmpty && netEmpty;
}
