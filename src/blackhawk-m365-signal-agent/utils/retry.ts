export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
) {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 250;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || (options.shouldRetry && !options.shouldRetry(error))) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}
