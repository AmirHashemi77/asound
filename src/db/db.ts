import Dexie, { Table } from "dexie";
import type { Playlist, StoredHandle, TrackMeta } from "./types";

class PlayerDB extends Dexie {
  tracks!: Table<TrackMeta, string>;
  playlists!: Table<Playlist, string>;
  handles!: Table<StoredHandle, string>;

  constructor() {
    super("prism-player");
    this.version(1).stores({
      tracks: "id, title, artist, album, addedAt",
      playlists: "id, name, updatedAt",
      handles: "id"
    });
  }
}

export const db = new PlayerDB();
