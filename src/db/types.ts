export interface TrackMeta {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  lastModified?: number;
  size?: number;
  coverUrl?: string;
  sourcePath?: string;
  signature?: string;
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

export type StoredHandle = StoredFileHandle | StoredDirectoryHandle;

interface StoredHandleBase {
  id: string;
  purpose?: "track" | "library-root";
}

interface StoredFileHandle extends StoredHandleBase {
  kind: "file";
  handle: FileSystemFileHandle;
}

interface StoredDirectoryHandle extends StoredHandleBase {
  kind: "directory";
  handle: FileSystemDirectoryHandle;
}
