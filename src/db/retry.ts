const TRANSIENT_PATTERNS = [
  "connection",
  "server lost",
  "unknownerror",
  "invalidstateerror",
  "quotaexceedederror"
];

const isTransientDbError = (error: unknown) => {
  const err = error as { name?: string; message?: string } | undefined;
  const text = `${err?.name ?? ""} ${err?.message ?? ""}`.toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => text.includes(pattern));
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Chrome's IndexedDB backend can crash under heavy write pressure (large
// batches, big blobs), surfacing as "Connection to Indexed Database server
// lost". Dexie reopens the underlying connection automatically once it
// notices the close, but only on the *next* operation - so a short delayed
// retry is usually enough to recover.
export const withDbRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts - 1) throw error;
      await delay(250 * (attempt + 1));
    }
  }
  throw lastError;
};
