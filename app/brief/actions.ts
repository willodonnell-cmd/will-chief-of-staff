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

function parseTaskPriority(value: string): TaskPriority {
  return isTaskPriority(value) ? value : "medium";
}

export async function createTaskFromBriefCandidateAction(formData: FormData) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirect("/brief?error=no-active-user");
  }

  const description = formString(formData, "description");
  if (!description) {
    redirect("/brief?error=missing-task-description");
  }

  const priority = parseTaskPriority(formString(formData, "priority"));
  const nextStep = formString(formData, "nextStep");
  const desiredOutcome = formString(formData, "desiredOutcome");
  const source = formString(formData, "source");
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
    redirect("/brief?error=task-category-missing");
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
      private_context: source ? `Executive Brief source: ${source}` : null,
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
        nextAction: nextStep || null,
        expectedOutcome: desiredOutcome || null
      },
      save_state: "saved",
      save_state_detail: null
    })
  );

  if (insert.error) {
    redirect("/brief?error=task-create-failed");
  }

  revalidatePath("/brief");
  revalidatePath("/library/tasks");
  redirect("/brief?notice=task-created");
}
