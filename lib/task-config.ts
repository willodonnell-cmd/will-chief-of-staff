import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

import type { TaskCaptureSettings, TaskCategoryOption } from "./blackhawk-capture-model";

type TaskCategoryRow = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "inactive";
  sort_order: number;
  is_fallback: boolean;
};

type TaskCaptureSettingsRow = {
  expand_next_step_by_default: boolean;
  expand_desired_outcome_by_default: boolean;
};

function mapCategory(row: TaskCategoryRow): TaskCategoryOption {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    sortOrder: row.sort_order,
    isFallback: row.is_fallback
  };
}

function defaultCaptureSettings(): TaskCaptureSettings {
  return {
    expandNextStepByDefault: false,
    expandDesiredOutcomeByDefault: false
  };
}

export async function listTaskCategories(options?: { includeInactive?: boolean }): Promise<TaskCategoryOption[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return [];
  }

  let request = resolved.client
    .from("task_categories")
    .select("id, slug, name, status, sort_order, is_fallback")
    .eq("user_id", resolved.user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!options?.includeInactive) {
    request = request.eq("status", "active");
  }

  const { data, error } = await request.returns<TaskCategoryRow[]>();
  if (error) {
    return [];
  }

  return (data ?? []).map(mapCategory);
}

export async function getTaskCaptureSettings(): Promise<TaskCaptureSettings> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return defaultCaptureSettings();
  }

  const { data, error } = await resolved.client
    .from("task_capture_settings")
    .select("expand_next_step_by_default, expand_desired_outcome_by_default")
    .eq("user_id", resolved.user.id)
    .maybeSingle<TaskCaptureSettingsRow>();

  if (error || !data) {
    return defaultCaptureSettings();
  }

  return {
    expandNextStepByDefault: data.expand_next_step_by_default,
    expandDesiredOutcomeByDefault: data.expand_desired_outcome_by_default
  };
}

export async function getTaskConfig() {
  const [categories, captureSettings] = await Promise.all([
    listTaskCategories({ includeInactive: false }),
    getTaskCaptureSettings()
  ]);

  const fallbackCategory =
    categories.find((category) => category.isFallback) ??
    categories.find((category) => category.name.trim().toLowerCase() === "tbd") ??
    null;
  const commonCategories = categories.filter((category) => !category.isFallback).slice(0, 5);

  return {
    categories,
    commonCategories,
    fallbackCategory,
    captureSettings
  };
}

function slugifyTaskCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getOwnedTaskCategory(categoryId: string) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false as const,
      error: "No active app user could be resolved."
    };
  }

  const { data, error } = await resolved.client
    .from("task_categories")
    .select("id, slug, name, status, sort_order, is_fallback")
    .eq("user_id", resolved.user.id)
    .eq("id", categoryId)
    .maybeSingle<TaskCategoryRow>();

  if (error || !data) {
    return {
      ok: false as const,
      error: "That category could not be found."
    };
  }

  return {
    ok: true as const,
    client: resolved.client,
    userId: resolved.user.id,
    category: data
  };
}

export async function createTaskCategory(name: string) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false as const,
      error: "No active app user could be resolved."
    };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return {
      ok: false as const,
      error: "Category name is required."
    };
  }

  const { data: existing } = await resolved.client
    .from("task_categories")
    .select("sort_order")
    .eq("user_id", resolved.user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { error } = await resolved.client.from("task_categories").insert({
    user_id: resolved.user.id,
    slug: slugifyTaskCategoryName(trimmedName) || `category-${Date.now()}`,
    name: trimmedName,
    status: "active",
    sort_order: (existing?.sort_order ?? -1) + 1,
    is_fallback: false
  });

  if (error) {
    return {
      ok: false as const,
      error: "Category could not be created."
    };
  }

  return {
    ok: true as const
  };
}

export async function renameTaskCategory(categoryId: string, name: string) {
  const owned = await getOwnedTaskCategory(categoryId);
  if (!owned.ok) {
    return owned;
  }

  if (owned.category.is_fallback) {
    return {
      ok: false as const,
      error: "The fallback TBD category is protected."
    };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return {
      ok: false as const,
      error: "Category name is required."
    };
  }

  const { error } = await owned.client
    .from("task_categories")
    .update({
      name: trimmedName,
      slug: slugifyTaskCategoryName(trimmedName) || owned.category.slug
    })
    .eq("user_id", owned.userId)
    .eq("id", categoryId);

  return error
    ? {
        ok: false as const,
        error: "Category could not be renamed."
      }
    : {
        ok: true as const
      };
}

export async function moveTaskCategory(categoryId: string, direction: "up" | "down") {
  const owned = await getOwnedTaskCategory(categoryId);
  if (!owned.ok) {
    return owned;
  }

  const comparator = direction === "up" ? "lt" : "gt";
  const ordering = { ascending: direction !== "up" };
  const { data: swapTarget, error: swapError } = await owned.client
    .from("task_categories")
    .select("id, sort_order")
    .eq("user_id", owned.userId)
    .filter("sort_order", comparator, owned.category.sort_order)
    .order("sort_order", ordering)
    .limit(1)
    .maybeSingle<{ id: string; sort_order: number }>();

  if (swapError || !swapTarget) {
    return {
      ok: true as const
    };
  }

  const { error: firstError } = await owned.client
    .from("task_categories")
    .update({ sort_order: swapTarget.sort_order })
    .eq("user_id", owned.userId)
    .eq("id", owned.category.id);

  const { error: secondError } = await owned.client
    .from("task_categories")
    .update({ sort_order: owned.category.sort_order })
    .eq("user_id", owned.userId)
    .eq("id", swapTarget.id);

  if (firstError || secondError) {
    return {
      ok: false as const,
      error: "Category order could not be updated."
    };
  }

  return {
    ok: true as const
  };
}

export async function deactivateTaskCategory(categoryId: string) {
  const owned = await getOwnedTaskCategory(categoryId);
  if (!owned.ok) {
    return owned;
  }

  if (owned.category.is_fallback) {
    return {
      ok: false as const,
      error: "The fallback TBD category cannot be deactivated."
    };
  }

  const { error } = await owned.client
    .from("task_categories")
    .update({ status: "inactive" })
    .eq("user_id", owned.userId)
    .eq("id", categoryId);

  return error
    ? {
        ok: false as const,
        error: "Category could not be deactivated."
      }
    : {
        ok: true as const
      };
}

export async function updateTaskCaptureSettings(input: TaskCaptureSettings) {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return {
      ok: false as const,
      error: "No active app user could be resolved."
    };
  }

  const { error } = await resolved.client
    .from("task_capture_settings")
    .upsert(
      {
        user_id: resolved.user.id,
        expand_next_step_by_default: input.expandNextStepByDefault,
        expand_desired_outcome_by_default: input.expandDesiredOutcomeByDefault
      },
      { onConflict: "user_id" }
    );

  return error
    ? {
        ok: false as const,
        error: "Task capture settings could not be saved."
      }
    : {
        ok: true as const
      };
}
