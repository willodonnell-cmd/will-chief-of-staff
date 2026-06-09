"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createSupabaseMeetingRecordsRepository,
  isMeetingRecordsSchemaUnavailableError,
  meetingCalendarEventIdFromBriefItemId
} from "@/lib/meetings/meeting-records";
import { runManualMeetingResearch, type MeetingResearchRunError } from "@/lib/meetings/meeting-research";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
      attendees: [],
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
