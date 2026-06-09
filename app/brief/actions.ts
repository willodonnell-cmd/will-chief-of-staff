"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildTaskWorkingContent,
  computeTaskDisplayTitle,
  isTaskPriority,
  type TaskPriority
} from "@/lib/blackhawk-capture-model";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export async function requestExecutiveBriefRefreshAction() {
  revalidatePath("/brief");
  revalidatePath("/agent-signal-brief");
}

type TaskCategoryRow = {
  id: string;
  name: string;
  status: string;
  is_fallback: boolean;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnTo(value: string) {
  if (value === "/" || value === "/brief" || value === "/library/tasks") {
    return value;
  }

  return "/brief";
}

function redirectWithStatus(path: string, key: "notice" | "error", value: string): never {
  const encoded = encodeURIComponent(value);
  if (path === "/") {
    redirect(key === "notice" ? `/?notice=${encoded}` : `/?error=${encoded}`);
  }

  if (path === "/library/tasks") {
    redirect(key === "notice" ? `/library/tasks?notice=${encoded}` : `/library/tasks?error=${encoded}`);
  }

  redirect(key === "notice" ? `/brief?notice=${encoded}` : `/brief?error=${encoded}`);
}

function parseTaskPriority(value: string): TaskPriority {
  return isTaskPriority(value) ? value : "medium";
}

function parseDismissReason(value: string) {
  return ["not_important", "already_handled", "not_my_task", "bad_recommendation"].includes(value)
    ? value
    : "not_important";
}

export async function createTaskFromBriefCandidateAction(formData: FormData) {
  const returnTo = safeReturnTo(formString(formData, "returnTo"));
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirectWithStatus(returnTo, "error", "no-active-user");
  }

  const description = formString(formData, "description");
  if (!description) {
    redirectWithStatus(returnTo, "error", "missing-task-description");
  }

  const priority = parseTaskPriority(formString(formData, "priority"));
  const nextStep = formString(formData, "nextStep");
  const desiredOutcome = formString(formData, "desiredOutcome");
  const source = formString(formData, "source");
  const sourceUrl = formString(formData, "sourceUrl");
  const briefItemId = formString(formData, "briefItemId");
  const sender = formString(formData, "sender");
  const dueAt = formString(formData, "dueAt") || null;
  const client = createSupabaseAdminClient() ?? resolved.client;

  const categoriesResponse = await withSupabaseTimeout(
    client
      .from("task_categories")
      .select("id, name, status, is_fallback")
      .eq("user_id", resolved.user.id)
      .order("sort_order", { ascending: true })
      .returns<TaskCategoryRow[]>()
  );
  const selectedCategory =
    (categoriesResponse.data ?? []).find((category) => category.status === "active" && category.is_fallback) ??
    (categoriesResponse.data ?? []).find((category) => category.status === "active") ??
    null;

  if (!selectedCategory) {
    redirectWithStatus(returnTo, "error", "task-category-missing");
  }

  const workingContent = buildTaskWorkingContent(
    {
      description,
      nextStep,
      desiredOutcome,
      priority,
      categoryId: selectedCategory.id,
      linkedInitiativeId: null,
      dueAt
    },
    {
      categoryName: selectedCategory.name,
      initiativeTitle: null
    }
  );
  const now = new Date().toISOString();
  const title = computeTaskDisplayTitle(description);
  const followUp = [nextStep, desiredOutcome].filter(Boolean).join("\n\n");

  const insert = await withSupabaseTimeout(
    client.from("captures").insert({
      user_id: resolved.user.id,
      source_path: "/brief",
      pattern: "task",
      privacy: "open",
      summary: description,
      follow_up: followUp || null,
      private_context: [source ? `Executive Brief source: ${source}` : null, sourceUrl ? `Source URL: ${sourceUrl}` : null]
        .filter(Boolean)
        .join("\n") || null,
      type: "task",
      title,
      task_description: description,
      task_next_step: nextStep || null,
      task_desired_outcome: desiredOutcome || null,
      task_category_id: selectedCategory.id,
      linked_initiative_id: null,
      origin_type: "email",
      original_content: workingContent,
      working_content: workingContent,
      last_active_at: now,
      due_at: dueAt,
      priority,
      executive_work_type: "delegation",
      capture_metadata: {
        captureType: "task",
        owner: source || null,
        sender: sender || null,
        sourceUrl: sourceUrl || null,
        briefItemId: briefItemId || null,
        nextAction: nextStep || null,
        expectedOutcome: desiredOutcome || null
      },
      save_state: "saved",
      save_state_detail: null
    })
  );

  if (insert.error) {
    redirectWithStatus(returnTo, "error", "task-create-failed");
  }

  revalidatePath("/");
  revalidatePath("/brief");
  revalidatePath("/library/tasks");
  redirectWithStatus(returnTo, "notice", "task-created");
}

export async function dismissBriefTaskCandidateAction(formData: FormData) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirect("/brief?error=no-active-user");
  }

  const snapshotId = formString(formData, "snapshotId");
  const itemId = formString(formData, "itemId");
  const itemTitle = formString(formData, "itemTitle");
  const reason = parseDismissReason(formString(formData, "reason"));

  if (!snapshotId || !itemId || !itemTitle) {
    redirect("/brief?error=missing-dismissal-context");
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const snapshotResponse = await withSupabaseTimeout(
    client
      .from("executive_brief_snapshots")
      .select("id")
      .eq("user_id", resolved.user.id)
      .eq("id", snapshotId)
      .maybeSingle<{ id: string }>()
  );

  if (snapshotResponse.error || !snapshotResponse.data) {
    redirect("/brief?error=snapshot-not-found");
  }

  const feedbackResponse = await withSupabaseTimeout(
    client.from("executive_brief_item_feedback").upsert(
      {
        user_id: resolved.user.id,
        snapshot_id: snapshotId,
        item_kind: "task_candidate",
        item_id: itemId,
        item_title: itemTitle,
        feedback_type: "dismissed",
        reason
      },
      {
        onConflict: "user_id,snapshot_id,item_kind,item_id,feedback_type"
      }
    )
  );

  if (feedbackResponse.error) {
    redirect("/brief?error=dismiss-failed");
  }

  revalidatePath("/brief");
  redirect("/brief?notice=task-dismissed");
}
