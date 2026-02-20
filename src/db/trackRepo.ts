import { db } from "./db";
import type { TrackMeta } from "./types";

export const trackRepo = {
  async upsertAll(tracks: TrackMeta[]) {
    await db.tracks.bulkPut(tracks);
  },
  async getAll() {
    return db.tracks.toArray();
  },
  async delete(id: string) {
    await db.tracks.delete(id);
  },
  async clear() {
    await db.tracks.clear();
  }
};
