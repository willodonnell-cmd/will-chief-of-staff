import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

export type CapturePattern = "note" | "task";
export type CapturePrivacy = "open" | "protected" | "hybrid";

export type SaveCaptureInput = {
  sourcePath: string | null;
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  followUp: string;
  privateContext: string;
};

type CaptureRecord = {
  id: string;
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  follow_up: string | null;
  private_context: string | null;
  source_path: string | null;
  captured_at: string;
};

export type SavedCapture = {
  id: string;
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  followUp: string;
  privateContext: string;
  sourcePath: string | null;
  capturedAt: string;
};

function mapCapture(record: CaptureRecord): SavedCapture {
  return {
    id: record.id,
    pattern: record.pattern,
    privacy: record.privacy,
    summary: record.summary,
    followUp: record.follow_up ?? "",
    privateContext: record.private_context ?? "",
    sourcePath: record.source_path,
    capturedAt: record.captured_at
  };
}

export async function saveCapture(input: SaveCaptureInput): Promise<SavedCapture | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const { client, user } = resolved;
  const { data, error } = await client
    .from("captures")
    .insert({
      user_id: user.id,
      source_path: input.sourcePath,
      pattern: input.pattern,
      privacy: input.privacy,
      summary: input.summary,
      follow_up: input.followUp || null,
      private_context: input.privateContext || null
    })
    .select("id, pattern, privacy, summary, follow_up, private_context, source_path, captured_at")
    .single<CaptureRecord>();

  if (error || !data) {
    return null;
  }

  return mapCapture(data);
}

export async function getRecentCaptures(limit = 10): Promise<SavedCapture[]> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return [];
  }

  const { client, user } = resolved;
  const { data, error } = await client
    .from("captures")
    .select("id, pattern, privacy, summary, follow_up, private_context, source_path, captured_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("captured_at", { ascending: false })
    .limit(limit)
    .returns<CaptureRecord[]>();

  if (error || !data) {
    return [];
  }

  return data.map(mapCapture);
}
