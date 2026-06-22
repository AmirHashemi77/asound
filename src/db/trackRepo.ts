import { db } from "./db";
import { withDbRetry } from "./retry";
import type { TrackMeta } from "./types";

const putBatch = async (tracks: TrackMeta[]): Promise<void> => {
  if (tracks.length === 0) return;
  try {
    await withDbRetry(() => db.tracks.bulkPut(tracks));
  } catch (error) {
    if (tracks.length === 1) throw error;
    // Still failing after retries likely means this batch is too large for
    // a single IndexedDB transaction (e.g. many embedded audio blobs) -
    // split it and retry the halves independently instead of losing the
    // whole batch.
    const mid = Math.ceil(tracks.length / 2);
    await putBatch(tracks.slice(0, mid));
    await putBatch(tracks.slice(mid));
  }
};

export const trackRepo = {
  async upsertAll(tracks: TrackMeta[]) {
    await putBatch(tracks);
  },
  async getAll() {
    return withDbRetry(() => db.tracks.toArray());
  },
  async delete(id: string) {
    await withDbRetry(() => db.tracks.delete(id));
  },
  async clear() {
    await withDbRetry(() => db.tracks.clear());
  }
};
