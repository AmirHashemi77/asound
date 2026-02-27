import { create } from "zustand";
import { handleRepo } from "../db/handleRepo";
import { playlistRepo } from "../db/playlistRepo";
import { trackRepo } from "../db/trackRepo";
import type { Playlist, TrackMeta } from "../db/types";
import {
  batch as chunkFiles,
  ensureReadPermission,
  type AudioImportCandidate,
  extractTrackMeta,
  getRememberedFolderName,
  getRememberedLibraryDirectory,
  normalizeAudioFiles,
  pickAudioDirectory,
  readAudioMetadata,
  rememberFolderName,
  scanAudioDirectory
} from "../lib/fileAccess";

export type RepeatMode = "off" | "one" | "all";
export type ImportMode = "folder" | "files" | "update";

const IMPORT_BATCH_SIZE = 25;
const LAST_IMPORT_MODE_KEY = "library-last-import-mode";
const HAS_IMPORTED_BEFORE_KEY = "library-has-imported-before";

const yieldToMainThread = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });

const readLastImportMode = (): Exclude<ImportMode, "update"> | null => {
  const saved = localStorage.getItem(LAST_IMPORT_MODE_KEY);
  if (saved === "folder" || saved === "files") return saved;
  return null;
};

const persistImportMode = (mode: Exclude<ImportMode, "update">) => {
  localStorage.setItem(LAST_IMPORT_MODE_KEY, mode);
};

const getTrackSignature = (track: TrackMeta) => {
  if (track.signature) return track.signature;
  if (!track.sourcePath) return null;
  if (typeof track.size !== "number" || typeof track.lastModified !== "number") return null;
  const fileName = track.sourcePath.split("/").pop() || "";
  return `${track.sourcePath}|${fileName}|${track.size}|${track.lastModified}`.toLowerCase();
};

export interface ImportProgress {
  phase: "preparing" | "importing" | "done";
  current: number;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  warning?: string;
  canceled?: boolean;
}

interface PlayerState {
  tracks: TrackMeta[];
  playlists: Playlist[];
  lastImportMode: Exclude<ImportMode, "update"> | null;
  hasImportedBefore: boolean;
  currentTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  setTracks: (tracks: TrackMeta[]) => void;
  addTracks: (tracks: TrackMeta[]) => void;
  removeTrack: (id: string) => void;
  setCurrent: (id: string | null) => void;
  setIsPlaying: (value: boolean) => void;
  setCurrentTime: (value: number) => void;
  setDuration: (value: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  loadLibrary: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  updatePlaylist: (playlist: Playlist) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  importPickedFiles: (
    files: File[],
    options?: {
      mode?: ImportMode;
      candidates?: AudioImportCandidate[];
      handles?: (FileSystemFileHandle | undefined)[];
      autoImport?: boolean;
      onProgress?: (progress: ImportProgress) => void;
    }
  ) => Promise<ImportResult>;
  rescanLibrary: (options?: {
    autoImport?: boolean;
    onProgress?: (progress: ImportProgress) => void;
  }) => Promise<ImportResult>;
}

const runImport = async (
  candidates: ReturnType<typeof normalizeAudioFiles>,
  options: {
    autoImport?: boolean;
    onProgress?: (progress: ImportProgress) => void;
    prependTracks: (tracks: TrackMeta[]) => void;
  }
): Promise<ImportResult> => {
  const total = candidates.length;
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  options.onProgress?.({
    phase: "preparing",
    current: 0,
    total,
    imported,
    skipped,
    failed
  });

  if (!total) {
    options.onProgress?.({
      phase: "done",
      current: 0,
      total,
      imported,
      skipped,
      failed
    });
    return { total, imported, skipped, failed };
  }

  const existingTracks = await trackRepo.getAll();
  const signatures = new Set(existingTracks.map(getTrackSignature).filter(Boolean) as string[]);
  const queue: ReturnType<typeof normalizeAudioFiles> = [];

  for (const candidate of candidates) {
    if (signatures.has(candidate.signature)) {
      skipped += 1;
      continue;
    }
    signatures.add(candidate.signature);
    queue.push(candidate);
  }

  const createdTracks: TrackMeta[] = [];
  let processed = 0;

  for (const group of chunkFiles(queue, IMPORT_BATCH_SIZE)) {
    for (const candidate of group) {
      try {
        const meta = await extractTrackMeta(candidate.file, {
          handle: candidate.handle,
          sourcePath: candidate.sourcePath,
          signature: candidate.signature
        });

        if (options.autoImport || !candidate.handle) {
          meta.source = "blob";
          meta.blob = candidate.file;
        }

        createdTracks.push(meta);
        imported += 1;
      } catch {
        failed += 1;
      } finally {
        processed += 1;
        options.onProgress?.({
          phase: "importing",
          current: Math.min(processed + skipped, total),
          total,
          imported,
          skipped,
          failed
        });
      }
    }

    await yieldToMainThread();
  }

  if (createdTracks.length > 0) {
    await trackRepo.upsertAll(createdTracks);
    options.prependTracks(createdTracks);
  }

  options.onProgress?.({
    phase: "done",
    current: total,
    total,
    imported,
    skipped,
    failed
  });

  return { total, imported, skipped, failed };
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  playlists: [],
  lastImportMode: readLastImportMode(),
  hasImportedBefore: localStorage.getItem(HAS_IMPORTED_BEFORE_KEY) === "true",
  currentTrackId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: "off",
  setTracks: (tracks) => set({ tracks }),
  addTracks: (tracks) => set({ tracks: [...tracks, ...get().tracks] }),
  removeTrack: (id) => {
    const trackToRemove = get().tracks.find((track) => track.id === id);
    if (trackToRemove?.coverUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(trackToRemove.coverUrl);
    }
    void trackRepo.delete(id);
    set({ tracks: get().tracks.filter((track) => track.id !== id) });
  },
  setCurrent: (id) => set({ currentTrackId: id }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  setCurrentTime: (value) => set({ currentTime: value }),
  setDuration: (value) => set({ duration: value }),
  toggleShuffle: () => set({ shuffle: !get().shuffle }),
  cycleRepeat: () => {
    const next: RepeatMode = get().repeat === "off" ? "all" : get().repeat === "all" ? "one" : "off";
    set({ repeat: next });
  },
  loadLibrary: async () => {
    const tracks = await trackRepo.getAll();
    const sorted = tracks.sort((a, b) => b.addedAt - a.addedAt);
    set({ tracks: sorted });

    const incomplete = sorted
      .filter(
        (track) =>
          (!track.artist || !track.duration || track.duration <= 0) &&
          (Boolean(track.blob) || Boolean(track.handleId))
      )
      .slice(0, 40);

    if (incomplete.length === 0) return;

    const repaired: TrackMeta[] = [];
    for (const track of incomplete) {
      try {
        let file: File | null = null;
        if (track.blob) {
          if (track.blob instanceof File) {
            file = track.blob;
          } else {
            file = new File([track.blob], `${track.title}.mp3`, {
              type: track.blob.type || "audio/mpeg",
              lastModified: track.lastModified || Date.now()
            });
          }
        } else if (track.handleId) {
          const stored = await handleRepo.get(track.handleId);
          if (stored && stored.kind === "file") {
            file = await (stored.handle as FileSystemFileHandle).getFile();
          }
        }

        if (!file) continue;

        const metadata = await readAudioMetadata(file);
        const nextTrack: TrackMeta = { ...track };
        let changed = false;

        if (!track.artist && metadata.artist) {
          nextTrack.artist = metadata.artist;
          changed = true;
        }
        if ((!track.duration || track.duration <= 0) && metadata.duration) {
          nextTrack.duration = metadata.duration;
          changed = true;
        }
        if (!track.album && metadata.album) {
          nextTrack.album = metadata.album;
          changed = true;
        }
        if (!track.coverUrl && metadata.coverUrl) {
          nextTrack.coverUrl = metadata.coverUrl;
          changed = true;
        } else if (metadata.coverUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(metadata.coverUrl);
        }

        const titleLooksRaw = track.title.includes(" - ");
        if (titleLooksRaw && metadata.title && metadata.title !== track.title) {
          nextTrack.title = metadata.title;
          changed = true;
        }

        if (changed) repaired.push(nextTrack);
      } catch {
        // Skip damaged or inaccessible files.
      }
    }

    if (repaired.length === 0) return;

    await trackRepo.upsertAll(repaired);
    const repairedMap = new Map(repaired.map((track) => [track.id, track]));
    set({
      tracks: get().tracks.map((track) => repairedMap.get(track.id) || track)
    });
  },
  loadPlaylists: async () => {
    const playlists = await playlistRepo.getAll();
    set({ playlists: playlists.sort((a, b) => b.updatedAt - a.updatedAt) });
  },
  createPlaylist: async (name) => {
    const playlist = await playlistRepo.create(name);
    set({ playlists: [playlist, ...get().playlists] });
    return playlist;
  },
  updatePlaylist: async (playlist) => {
    await playlistRepo.update(playlist);
    set({
      playlists: get().playlists.map((item) => (item.id === playlist.id ? playlist : item))
    });
  },
  deletePlaylist: async (id) => {
    await playlistRepo.delete(id);
    set({ playlists: get().playlists.filter((item) => item.id !== id) });
  },
  importPickedFiles: async (files, options) => {
    const candidates = options?.candidates || normalizeAudioFiles(files, options?.handles);
    const result = await runImport(candidates, {
      autoImport: options?.autoImport,
      onProgress: options?.onProgress,
      prependTracks: (tracks) => {
        set({ tracks: [...tracks, ...get().tracks] });
      }
    });

    const folderNames = new Set(candidates.map((candidate) => candidate.sourcePath?.split("/")[0]).filter(Boolean));
    if (folderNames.size === 1) {
      const folderName = Array.from(folderNames)[0];
      if (folderName) rememberFolderName(folderName);
    }

    if (options?.mode === "folder" || options?.mode === "files") {
      persistImportMode(options.mode);
      set({ lastImportMode: options.mode });
    }
    if (result.imported > 0) {
      localStorage.setItem(HAS_IMPORTED_BEFORE_KEY, "true");
      set({ hasImportedBefore: true });
    }

    return result;
  },
  rescanLibrary: async (options) => {
    const previousFolder = getRememberedFolderName();
    let warning: string | undefined;

    let directoryHandle = await getRememberedLibraryDirectory();
    if (directoryHandle) {
      const hasPermission = await ensureReadPermission(directoryHandle).catch(() => false);
      if (!hasPermission) {
        directoryHandle = null;
      }
    }

    let candidates: ReturnType<typeof normalizeAudioFiles> = [];

    if (directoryHandle) {
      try {
        candidates = await scanAudioDirectory(directoryHandle);
        rememberFolderName(directoryHandle.name);
      } catch {
        directoryHandle = null;
      }
    }

    if (!directoryHandle) {
      try {
        const picked = await pickAudioDirectory();
        if (!picked.rootHandle) {
          return { total: 0, imported: 0, skipped: 0, failed: 0, canceled: true };
        }

        candidates = picked.files;
        rememberFolderName(picked.rootHandle.name);

        if (previousFolder && previousFolder !== picked.rootHandle.name) {
          warning = `You selected a different folder (${picked.rootHandle.name}) than before (${previousFolder}).`;
        }
      } catch {
        return { total: 0, imported: 0, skipped: 0, failed: 0, canceled: true };
      }
    }

    const result = await runImport(candidates, {
      autoImport: options?.autoImport,
      onProgress: options?.onProgress,
      prependTracks: (tracks) => {
        set({ tracks: [...tracks, ...get().tracks] });
      }
    });

    persistImportMode("folder");
    set({ lastImportMode: "folder" });
    if (result.imported > 0) {
      localStorage.setItem(HAS_IMPORTED_BEFORE_KEY, "true");
      set({ hasImportedBefore: true });
    }

    return {
      ...result,
      warning
    };
  }
}));
