export type Track = {
  id: string;
  title: string;
  artist: string;
  uri: string;
  duration: number;
  artworkUri: string | null;
  createdAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
};

export type ImportProgress = {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
};

export type PlaybackMetadata = {
  title: string;
  artist: string;
  artworkUri: string | null;
};
