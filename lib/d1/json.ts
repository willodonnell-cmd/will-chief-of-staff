import type { JsonValue } from "@/lib/brief/executive-brief-snapshots";

export function encodeD1Json(value: JsonValue | JsonValue[] | null | undefined) {
  return JSON.stringify(value ?? null);
}

export function encodeD1JsonArray(value: JsonValue[] | null | undefined) {
  return JSON.stringify(value ?? []);
}

export function decodeD1Json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
