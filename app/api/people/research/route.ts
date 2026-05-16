import { NextResponse } from "next/server";

import { groupVaultResults, searchVaultForPerson } from "@/lib/obsidian-search";
import { runPeopleResearch, type ResearchRequestBody } from "@/lib/people-research-backend";

export async function POST(request: Request) {
  let body: ResearchRequestBody;
  try {
    body = (await request.json()) as ResearchRequestBody;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof body.name !== "string" ||
    typeof body.organization !== "string" ||
    typeof body.title !== "string" ||
    (body.current_read !== null && typeof body.current_read !== "string")
  ) {
    return NextResponse.json({ ok: false as const, error: "invalid_body" }, { status: 400 });
  }

  // Run web research and vault search in parallel
  const [webResult, vaultExcerpts] = await Promise.all([
    runPeopleResearch(body),
    searchVaultForPerson(body.name)
  ]);

  if (!webResult.ok) {
    if (webResult.error === "missing_key" || webResult.error === "no_provider") {
      return NextResponse.json({ ok: false as const, error: webResult.error }, { status: 503 });
    }
    return NextResponse.json({ ok: false as const, error: webResult.error }, { status: 502 });
  }

  const vault_results = groupVaultResults(vaultExcerpts);

  return NextResponse.json({
    ok: true as const,
    data: { ...webResult.data, vault_results }
  });
}
