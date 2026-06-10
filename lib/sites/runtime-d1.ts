import type { D1Database } from "@/lib/d1/types";

type GlobalWithD1 = typeof globalThis & {
  DB?: D1Database;
  __BLACKHAWK_D1_DB__?: D1Database;
};

function isD1Database(value: unknown): value is D1Database {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { prepare?: unknown }).prepare === "function"
  );
}

export async function loadRuntimeD1Database() {
  const globalWithD1 = globalThis as GlobalWithD1;
  const globalD1 = globalWithD1.__BLACKHAWK_D1_DB__ ?? globalWithD1.DB;
  if (isD1Database(globalD1)) {
    return globalD1;
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    const db = (context.env as Record<string, unknown>).DB;
    return isD1Database(db) ? db : null;
  } catch {
    return null;
  }
}
