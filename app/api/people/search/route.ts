import { NextResponse } from "next/server";

import { searchPeopleIndexForCurrentUser } from "@/lib/people-directory";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ people: [] });
  }

  const people = await searchPeopleIndexForCurrentUser(q);
  return NextResponse.json({ people });
}
