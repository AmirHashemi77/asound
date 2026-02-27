export const DB_VERSION = 1;

export const MIGRATIONS: Array<{ version: number; statements: string[] }> = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        uri TEXT NOT NULL,
        duration INTEGER NOT NULL,
        artworkUri TEXT,
        createdAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlistId TEXT NOT NULL,
        trackId TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlistId, trackId),
        FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(createdAt DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlistId, position);`
    ]
  }
];
