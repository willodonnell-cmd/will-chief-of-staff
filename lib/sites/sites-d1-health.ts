import { D1_BINDING_NAME, D1_TABLES } from "@/db/schema";
import type { D1Database } from "@/lib/d1/types";
import { loadRuntimeD1Database } from "@/lib/sites/runtime-d1";

export type SitesD1Health = {
  d1BindingName: string;
  d1BindingAvailable: boolean;
  briefSourceMode: "supabase" | "d1" | "parallel";
  workspaceIngestEnabled: boolean;
  primaryUserConfigured: boolean;
  agentIngestSecretConfigured: boolean;
  cloudMailInFallbackActive: boolean;
  latestSnapshot: {
    id: string;
    slot: string;
    generatedAt: string | null;
    createdAt: string;
  } | null;
  checkedAt: string;
};

type LatestSnapshotRow = {
  id: string;
  slot: string;
  generated_at: string | null;
  created_at: string;
};

function briefSourceMode(): SitesD1Health["briefSourceMode"] {
  const configured = process.env.BLACKHAWK_BRIEF_SOURCE?.trim().toLowerCase();
  if (configured === "d1" || configured === "parallel") {
    return configured;
  }

  return "supabase";
}

function ingestSecretConfigured() {
  return Boolean(
    process.env.BLACKHAWK_AGENT_INGEST_SECRET?.trim() ||
      process.env.BLACKHAWK_BRIEF_INGEST_SECRET?.trim()
  );
}

async function latestSnapshot(db: D1Database | null) {
  if (!db) {
    return null;
  }

  try {
    const row = await db
      .prepare(
        `SELECT id, slot, generated_at, created_at
         FROM ${D1_TABLES.executiveBriefSnapshots}
         ORDER BY COALESCE(generated_at, created_at) DESC, created_at DESC
         LIMIT 1`
      )
      .first<LatestSnapshotRow>();

    return row
      ? {
          id: row.id,
          slot: row.slot,
          generatedAt: row.generated_at,
          createdAt: row.created_at
        }
      : null;
  } catch {
    return null;
  }
}

export async function loadSitesD1Health(): Promise<SitesD1Health> {
  const db = await loadRuntimeD1Database();
  return {
    d1BindingName: D1_BINDING_NAME,
    d1BindingAvailable: Boolean(db),
    briefSourceMode: briefSourceMode(),
    workspaceIngestEnabled: process.env.BLACKHAWK_ENABLE_WORKSPACE_AGENT_INGEST === "true",
    primaryUserConfigured: Boolean(process.env.BLACKHAWK_PRIMARY_USER_EMAIL?.trim()),
    agentIngestSecretConfigured: ingestSecretConfigured(),
    cloudMailInFallbackActive: process.env.BLACKHAWK_CLOUDMAILIN_FALLBACK_ACTIVE !== "false",
    latestSnapshot: await latestSnapshot(db),
    checkedAt: new Date().toISOString()
  };
}
