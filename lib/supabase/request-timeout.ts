const DEFAULT_TIMEOUT_MS = 20_000;
const MIN_CONFIGURED_TIMEOUT_MS = 10_000;
const MAX_CONFIGURED_TIMEOUT_MS = 120_000;

function getDefaultTimeoutMs() {
  const raw = process.env.SUPABASE_REQUEST_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  // Guardrail: very low values make SSR pages look "broken" (empty lists, missing data)
  // when Supabase is merely slow or cold-starting. Explicit per-call timeouts can still be lower.
  return Math.min(MAX_CONFIGURED_TIMEOUT_MS, Math.max(MIN_CONFIGURED_TIMEOUT_MS, parsed));
}

export async function withSupabaseTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = getDefaultTimeoutMs()
): Promise<T> {
  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Supabase request timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      // Avoid holding the event loop open.
      timer.unref?.();
    })
  ]);
}
