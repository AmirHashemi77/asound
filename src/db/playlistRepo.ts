import { db } from "./db";
import type { Playlist } from "./types";

export const playlistRepo = {
  async getAll() {
    return db.playlists.toArray();
  },
  async create(name: string) {
    const now = Date.now();
    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name,
      trackIds: [],
      createdAt: now,
      updatedAt: now
    };
    await db.playlists.put(playlist);
    return playlist;
  },
  async update(playlist: Playlist) {
    await db.playlists.put({ ...playlist, updatedAt: Date.now() });
  },
  async delete(id: string) {
    await db.playlists.delete(id);
  }
};
