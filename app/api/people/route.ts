import { NextResponse } from "next/server";

import { createPersonInVault } from "@/lib/people-directory";

type Body = {
  full_name?: string;
  organization?: string | null;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false as const, error: "invalid_json" }, { status: 400 });
  }

  const result = await createPersonInVault({
    full_name: typeof body.full_name === "string" ? body.full_name : "",
    organization: typeof body.organization === "string" ? body.organization : null
  });

  if (!result.ok) {
    if (result.code === "validation") {
      return NextResponse.json({ ok: false as const, error: result.error, code: result.code }, { status: 400 });
    }
    if (result.code === "no_user") {
      return NextResponse.json({ ok: false as const, error: result.error, code: result.code }, { status: 503 });
    }
    return NextResponse.json({ ok: false as const, error: result.error, code: result.code }, { status: 422 });
  }

  return NextResponse.json({ ok: true as const, person: result.person });
}
