export interface TrackMeta {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  lastModified?: number;
  size?: number;
  coverUrl?: string;
  addedAt: number;
  source: "handle" | "file" | "blob";
  handleId?: string;
  blob?: Blob;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredHandle {
  id: string;
  handle: FileSystemFileHandle;
}
