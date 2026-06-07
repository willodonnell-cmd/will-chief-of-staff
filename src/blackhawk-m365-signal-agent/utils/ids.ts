import { createHash } from "node:crypto";

import type { SignalSource } from "../payload/schemas";

export function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function stableHash(parts: Array<string | null | undefined>) {
  const hash = createHash("sha1");
  hash.update(parts.filter(Boolean).join("::"));
  return hash.digest("hex").slice(0, 16);
}

export function buildSignalId(
  source: SignalSource,
  primaryId: string,
  secondaryParts: Array<string | null | undefined> = []
) {
  const normalizedPrimary = normalizeKey(primaryId) || stableHash([primaryId]);
  if (secondaryParts.length === 0) {
    return `${source}-${normalizedPrimary}`;
  }

  return `${source}-${normalizedPrimary}-${stableHash(secondaryParts)}`;
}
