"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createSupabaseMeetingRecordsRepository,
  isMeetingRecordsSchemaUnavailableError,
  meetingCalendarEventIdFromBriefItemId
} from "@/lib/meetings/meeting-records";
import { runManualMeetingResearch, type MeetingResearchRunError } from "@/lib/meetings/meeting-research";
import { exportMeetingRecordToTaskRobin } from "@/lib/meetings/meeting-obsidian-export";
import { createTaskFromMeetingTaskCandidate } from "@/lib/meetings/meeting-task-candidates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formJsonArray(formData: FormData, key: string) {
  const raw = formString(formData, key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseReturnTo(value: string) {
  return value === "/brief" ? "/brief" : "/";
}

function redirectWithStatus(returnTo: string, kind: "notice" | "error", value: string): never {
  const encoded = encodeURIComponent(value);
  if (returnTo === "/brief") {
    if (kind === "notice") {
      redirect(`/brief?notice=${encoded}` as `/brief?notice=${string}`);
    }
    redirect(`/brief?error=${encoded}` as `/brief?error=${string}`);
  }

  if (kind === "notice") {
    redirect(`/?notice=${encoded}` as `/?notice=${string}`);
  }
  redirect(`/?error=${encoded}` as `/?error=${string}`);
}

export async function researchMeetingContextAction(formData: FormData) {
  const returnTo = parseReturnTo(formString(formData, "returnTo"));
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirectWithStatus(returnTo, "error", "no-active-user");
  }

  const itemId = formString(formData, "briefItemId");
  const title = formString(formData, "title");
  if (!itemId || !title) {
    redirectWithStatus(returnTo, "error", "missing-meeting-context");
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const repository = createSupabaseMeetingRecordsRepository(client);
  const calendarEventId = formString(formData, "calendarEventId") || meetingCalendarEventIdFromBriefItemId(itemId);
  let result: Awaited<ReturnType<typeof runManualMeetingResearch>>;

  try {
    result = await runManualMeetingResearch(repository, {
      userId: resolved.user.id,
      calendarEventId,
      calendarSourceSystemId: formString(formData, "calendarSourceSystemId") || "executive_brief",
      title,
      startAt: formString(formData, "startAt") || null,
      endAt: formString(formData, "endAt") || null,
      timezone: resolved.user.timezone || "America/Los_Angeles",
      organizerName: formString(formData, "organizerName") || null,
      organizerEmail: formString(formData, "organizerEmail") || null,
      attendees: formJsonArray(formData, "attendees"),
      locationOrLink: formString(formData, "locationOrLink") || null,
      descriptionSummary: formString(formData, "descriptionSummary") || null,
      sourceRefs: [
        {
          sourceType: "executive_brief",
          briefItemId: itemId,
          href: "/brief"
        }
      ]
    });
  } catch (error) {
    if (isMeetingRecordsSchemaUnavailableError(error)) {
      redirectWithStatus(returnTo, "error", "meeting-records-schema-missing");
    }
    result = { ok: false, error: "storage" as MeetingResearchRunError, record: null };
  }

  revalidatePath("/");
  revalidatePath("/brief");

  if (!result.ok) {
    redirectWithStatus(returnTo, "error", `meeting-research-${result.error}`);
  }

  redirectWithStatus(returnTo, "notice", "meeting-researched");
}

export async function createTaskFromMeetingCandidateAction(formData: FormData) {
  const returnTo = parseReturnTo(formString(formData, "returnTo"));
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirectWithStatus(returnTo, "error", "no-active-user");
  }

  const meetingRecordId = formString(formData, "meetingRecordId");
  const dedupeKey = formString(formData, "dedupeKey");
  if (!meetingRecordId || !dedupeKey) {
    redirectWithStatus(returnTo, "error", "missing-meeting-task-candidate");
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const repository = createSupabaseMeetingRecordsRepository(client);
  let result: Awaited<ReturnType<typeof createTaskFromMeetingTaskCandidate>>;

  try {
    result = await createTaskFromMeetingTaskCandidate({
      client,
      repository,
      userId: resolved.user.id,
      meetingRecordId,
      dedupeKey
    });
  } catch (error) {
    if (isMeetingRecordsSchemaUnavailableError(error)) {
      redirectWithStatus(returnTo, "error", "meeting-records-schema-missing");
    }
    result = { ok: false, error: "storage" };
  }

  revalidatePath("/");
  revalidatePath("/brief");
  revalidatePath("/library/tasks");
  if (result.ok) {
    revalidatePath(`/library/${result.captureId}`);
  }

  if (!result.ok) {
    redirectWithStatus(returnTo, "error", `meeting-task-${result.error}`);
  }

  redirectWithStatus(
    returnTo,
    "notice",
    result.status === "already_exists" ? "meeting-task-already-exists" : "meeting-task-created"
  );
}

export async function saveMeetingToObsidianAction(formData: FormData) {
  const returnTo = parseReturnTo(formString(formData, "returnTo"));
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    redirectWithStatus(returnTo, "error", "no-active-user");
  }

  const meetingRecordId = formString(formData, "meetingRecordId");
  if (!meetingRecordId) {
    redirectWithStatus(returnTo, "error", "missing-meeting-record");
  }

  const client = createSupabaseAdminClient() ?? resolved.client;
  const repository = createSupabaseMeetingRecordsRepository(client);
  let result: Awaited<ReturnType<typeof exportMeetingRecordToTaskRobin>>;

  try {
    result = await exportMeetingRecordToTaskRobin({
      repository,
      userId: resolved.user.id,
      meetingRecordId
    });
  } catch (error) {
    if (isMeetingRecordsSchemaUnavailableError(error)) {
      redirectWithStatus(returnTo, "error", "meeting-records-schema-missing");
    }
    redirectWithStatus(returnTo, "error", "meeting-obsidian-storage");
  }

  revalidatePath("/");
  revalidatePath("/brief");

  if (!result.ok) {
    redirectWithStatus(returnTo, "error", `meeting-obsidian-${result.error}`);
  }

  redirectWithStatus(returnTo, "notice", "sent-to-taskrobin-for-obsidian-capture");
}
