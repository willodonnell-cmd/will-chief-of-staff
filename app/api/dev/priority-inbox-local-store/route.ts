import { NextResponse } from "next/server";

import type { PriorityInboxTransitionPayload } from "@/lib/priority-inbox";
import {
  listLocalPriorityInboxItems,
  listLocalPriorityInboxLibraryItems,
  resetLocalPriorityInboxData,
  transitionLocalPriorityInboxItem
} from "@/lib/priority-inbox-local-store";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function notAvailableResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "This dev-only route is not available in production."
    },
    { status: 404 }
  );
}

function buildTaskPayload(body: Record<string, unknown>): PriorityInboxTransitionPayload {
  const priority = `${body.priority ?? ""}`.trim();

  return {
    nextState: "handled",
    disposition: "task_created",
    dispositionLabel: "Task created",
    canonicalTask: {
      description: `${body.description ?? ""}`.trim(),
      nextStep: `${body.nextStep ?? ""}`.trim() || null,
      desiredOutcome: `${body.desiredOutcome ?? ""}`.trim() || null,
      priority: priority === "high" || priority === "medium" || priority === "low" ? priority : null,
      categoryId: `${body.categoryId ?? ""}`.trim() || null,
      linkedInitiativeId: `${body.linkedInitiativeId ?? ""}`.trim() || null
    }
  };
}

function buildReferencePayload(body: Record<string, unknown>): PriorityInboxTransitionPayload {
  return {
    nextState: "handled",
    disposition: "reference_saved",
    dispositionLabel: "Saved reference",
    canonicalReference: {
      title: `${body.title ?? ""}`.trim(),
      summary: `${body.summary ?? ""}`.trim()
    }
  };
}

function buildCommitmentPayload(body: Record<string, unknown>): PriorityInboxTransitionPayload {
  return {
    nextState: "handled",
    disposition: "commitment_created",
    dispositionLabel: "Commitment created",
    canonicalCommitment: {
      statement: `${body.statement ?? ""}`.trim(),
      owedTo: `${body.owedTo ?? ""}`.trim(),
      dueAt: `${body.dueAt ?? ""}`.trim() || null,
      dueLabel: `${body.dueLabel ?? ""}`.trim() || null,
      contextNote: `${body.contextNote ?? ""}`.trim() || null
    }
  };
}

function buildPayload(body: Record<string, unknown>) {
  const action = `${body.action ?? ""}`.trim();

  switch (action) {
    case "task":
      return buildTaskPayload(body);
    case "reference":
      return buildReferencePayload(body);
    case "commitment":
      return buildCommitmentPayload(body);
    default:
      return null;
  }
}

async function requireResolvedUser() {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  return resolved;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return notAvailableResponse();
  }

  const resolved = await requireResolvedUser();
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "No active app user could be resolved." }, { status: 401 });
  }

  const [items, libraryItems] = await Promise.all([
    listLocalPriorityInboxItems(resolved.user.id),
    listLocalPriorityInboxLibraryItems(resolved.user.id)
  ]);

  return NextResponse.json({
    ok: true,
    userId: resolved.user.id,
    itemCount: items.length,
    libraryItemCount: libraryItems.length,
    items,
    libraryItems
  });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return notAvailableResponse();
  }

  const resolved = await requireResolvedUser();
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "No active app user could be resolved." }, { status: 401 });
  }

  await resetLocalPriorityInboxData(resolved.user.id);

  return NextResponse.json({
    ok: true,
    userId: resolved.user.id
  });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return notAvailableResponse();
  }

  const resolved = await requireResolvedUser();
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "No active app user could be resolved." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "JSON body is required." }, { status: 400 });
  }

  const itemId = `${body.itemId ?? ""}`.trim();
  if (!itemId) {
    return NextResponse.json({ ok: false, error: "itemId is required." }, { status: 400 });
  }

  const payload = buildPayload(body);
  if (!payload) {
    return NextResponse.json({ ok: false, error: "action must be task, reference, or commitment." }, { status: 400 });
  }

  const item = await transitionLocalPriorityInboxItem({
    userId: resolved.user.id,
    itemId,
    payload
  });

  if (!item) {
    return NextResponse.json({ ok: false, error: "Priority Inbox item could not be found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    item
  });
}
