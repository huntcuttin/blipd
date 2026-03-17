/**
 * Retry helper with exponential backoff for external API calls.
 * Used by cron jobs to handle transient failures from YouTube, IGDB, Nintendo, etc.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    baseDelay?: number;
    label?: string;
  } = {}
): Promise<T> {
  const { retries = 3, baseDelay = 1000, label = "operation" } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `[retry] ${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
          err instanceof Error ? err.message : err
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't resolve within `ms`.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = "operation"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Fetches a URL with retry and timeout built in.
 * Drop-in replacement for fetch() in cron jobs.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: {
    retries?: number;
    baseDelay?: number;
    timeoutMs?: number;
    label?: string;
  } = {}
): Promise<Response> {
  const { retries = 2, baseDelay = 1000, timeoutMs = 15000, label = url } = options;

  return withRetry(
    async () => {
      const res = await withTimeout(
        fetch(url, init),
        timeoutMs,
        `fetch ${label}`
      );
      if (!res.ok && res.status >= 500) {
        throw new Error(`${label} returned ${res.status}`);
      }
      return res;
    },
    { retries, baseDelay, label }
  );
}
