import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { createId } from "../utils/id";
import type { Playlist, Track } from "../utils/types";
import { DB_VERSION, MIGRATIONS } from "./migrations";

const db = openDatabaseSync("asound-native.db");

let initialized = false;

const runInTransaction = async (runner: () => Promise<void>) => {
  await db.execAsync("BEGIN TRANSACTION;");
  try {
    await runner();
    await db.execAsync("COMMIT;");
  } catch (error) {
    await db.execAsync("ROLLBACK;");
    throw error;
  }
};

const getDbVersion = async () => {
  const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  return result?.user_version ?? 0;
};

const setDbVersion = async (version: number) => {
  await db.execAsync(`PRAGMA user_version = ${version};`);
};

const runMigrations = async (database: SQLiteDatabase) => {
  const currentVersion = await getDbVersion();
  const pending = MIGRATIONS.filter((item) => item.version > currentVersion).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await runInTransaction(async () => {
      for (const statement of migration.statements) {
        await database.execAsync(statement);
      }
      await setDbVersion(migration.version);
    });
  }
};

export const initDatabase = async () => {
  if (initialized) return;

  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await runMigrations(db);

  const version = await getDbVersion();
  if (version < DB_VERSION) {
    await setDbVersion(DB_VERSION);
  }

  initialized = true;
};

export const trackRepo = {
  async getAll() {
    return db.getAllAsync<Track>("SELECT * FROM tracks ORDER BY createdAt DESC;");
  },
  async saveMany(tracks: Track[]) {
    if (tracks.length === 0) return;

    await runInTransaction(async () => {
      for (const track of tracks) {
        await db.runAsync(
          `INSERT OR REPLACE INTO tracks (id, title, artist, uri, duration, artworkUri, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          track.id,
          track.title,
          track.artist,
          track.uri,
          track.duration,
          track.artworkUri,
          track.createdAt
        );
      }
    });
  },
  async remove(id: string) {
    await db.runAsync("DELETE FROM tracks WHERE id = ?;", id);
  }
};

export const playlistRepo = {
  async getAll() {
    return db.getAllAsync<Playlist>("SELECT * FROM playlists ORDER BY createdAt DESC;");
  },
  async create(name: string) {
    const playlist: Playlist = {
      id: createId(),
      name,
      createdAt: Date.now()
    };

    await db.runAsync(
      `INSERT INTO playlists (id, name, createdAt)
       VALUES (?, ?, ?);`,
      playlist.id,
      playlist.name,
      playlist.createdAt
    );

    return playlist;
  },
  async remove(playlistId: string) {
    await db.runAsync("DELETE FROM playlists WHERE id = ?;", playlistId);
  },
  async rename(playlistId: string, name: string) {
    await db.runAsync("UPDATE playlists SET name = ? WHERE id = ?;", name, playlistId);
  }
};

export const playlistTrackRepo = {
  async getTrackIds(playlistId: string) {
    const rows = await db.getAllAsync<{ trackId: string }>(
      "SELECT trackId FROM playlist_tracks WHERE playlistId = ? ORDER BY position ASC;",
      playlistId
    );
    return rows.map((row) => row.trackId);
  },

  async replace(playlistId: string, trackIds: string[]) {
    await runInTransaction(async () => {
      await db.runAsync("DELETE FROM playlist_tracks WHERE playlistId = ?;", playlistId);

      for (let index = 0; index < trackIds.length; index += 1) {
        await db.runAsync(
          `INSERT INTO playlist_tracks (playlistId, trackId, position)
           VALUES (?, ?, ?);`,
          playlistId,
          trackIds[index],
          index
        );
      }
    });
  },

  async append(playlistId: string, trackId: string) {
    const current = await db.getFirstAsync<{ maxPos: number | null }>(
      "SELECT MAX(position) AS maxPos FROM playlist_tracks WHERE playlistId = ?;",
      playlistId
    );
    const nextPosition = (current?.maxPos ?? -1) + 1;

    await db.runAsync(
      `INSERT OR REPLACE INTO playlist_tracks (playlistId, trackId, position)
       VALUES (?, ?, ?);`,
      playlistId,
      trackId,
      nextPosition
    );
  },

  async remove(playlistId: string, trackId: string) {
    const ids = await this.getTrackIds(playlistId);
    const next = ids.filter((id) => id !== trackId);
    await this.replace(playlistId, next);
  }
};

export const hydratePlaylistTrackMap = async (playlistIds: string[]) => {
  const map: Record<string, string[]> = {};

  for (const playlistId of playlistIds) {
    map[playlistId] = await playlistTrackRepo.getTrackIds(playlistId);
  }

  return map;
};

export const dbClient = db;
