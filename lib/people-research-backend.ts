import type { ResearchPayload } from "@/lib/people-research-types";

export type ResearchRequestBody = {
  name: string;
  organization: string;
  title: string;
  current_read: string | null;
};

export type ResearchRunError = "missing_key" | "no_provider" | "upstream" | "parse" | "network";

function extractJsonObject(raw: string): ResearchPayload | null {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as ResearchPayload;
  } catch {
    return null;
  }
}

function parseResearchFromAnthropicContent(content: unknown): ResearchPayload | null {
  if (!Array.isArray(content)) return null;
  const texts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; text?: string };
    if (b.type === "text" && typeof b.text === "string") texts.push(b.text);
  }
  for (const t of texts) {
    const one = extractJsonObject(t);
    if (one) return one;
  }
  return extractJsonObject(texts.join("\n"));
}

function extractOpenAiAssistantText(data: { output?: unknown[] }): string {
  if (!Array.isArray(data.output)) return "";
  const chunks: string[] = [];
  for (const item of data.output) {
    if (!item || typeof item !== "object") continue;
    const it = item as { type?: string; content?: unknown[] };
    if (it.type !== "message" || !Array.isArray(it.content)) continue;
    for (const part of it.content) {
      if (!part || typeof part !== "object") continue;
      const p = part as { type?: string; text?: string };
      if (typeof p.text !== "string") continue;
      if (p.type === "output_text" || p.type === "text") chunks.push(p.text);
    }
  }
  return chunks.join("\n");
}

function buildPrompts(body: ResearchRequestBody) {
  const currentRead = body.current_read ?? "None provided.";
  const system = `You are researching a professional contact for an executive chief of staff system. Search for current information about this person and return structured JSON in exactly this format:
{
  "current_role": { "text": "...", "source": "..." },
  "recent_news": [{ "headline": "...", "text": "...", "source": "...", "date": "..." }],
  "writing": [{ "title": "...", "platform": "...", "date": "..." }],
  "network": [{ "connection": "...", "context": "..." }],
  "suggested_read_update": "..." or null
}
Return only valid JSON. No preamble. No markdown. Only generate suggested_read_update if research reveals a role change, significant funding event, or direct contradiction of the current read. Otherwise null.`;

  const userContent = `Research this person: ${body.name} at ${body.organization}, title: ${body.title}. Current read: ${currentRead}. Find current role, recent news, published writing or talks, and any connections to Prologis or industrial real estate ecosystem.`;

  return { system, userContent };
}

function resolveProvider(): "openai" | "anthropic" | null {
  const explicit = process.env.RESEARCH_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "openai" || explicit === "anthropic") return explicit;
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return null;
}

export async function runPeopleResearch(
  body: ResearchRequestBody
): Promise<{ ok: true; data: ResearchPayload } | { ok: false; error: ResearchRunError }> {
  const provider = resolveProvider();
  if (!provider) return { ok: false, error: "no_provider" };

  const { system, userContent } = buildPrompts(body);

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return { ok: false, error: "missing_key" };

    const model = process.env.OPENAI_RESEARCH_MODEL?.trim() || "gpt-4.1";
    const orgId = process.env.OPENAI_ORG_ID?.trim();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      };
      if (orgId) {
        headers["OpenAI-Organization"] = orgId;
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          input: [
            { role: "system", content: system },
            { role: "user", content: userContent }
          ],
          tools: [{ type: "web_search_preview" }],
          max_output_tokens: 1500
        })
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "(unreadable)");
        console.error("[people-research] OpenAI error", response.status, errBody);
        return { ok: false, error: "upstream" };
      }

      const data = (await response.json()) as { output?: unknown[] };
      const combined = extractOpenAiAssistantText(data);
      const parsed = extractJsonObject(combined);
      if (!parsed) return { ok: false, error: "parse" };
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "missing_key" };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system,
        messages: [{ role: "user", content: userContent }]
      })
    });

    if (!response.ok) return { ok: false, error: "upstream" };

    const data = (await response.json()) as { content?: unknown };
    const parsed = parseResearchFromAnthropicContent(data.content ?? []);
    if (!parsed) return { ok: false, error: "parse" };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "network" };
  }
}
