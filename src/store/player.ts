import { create } from "zustand";
import { handleRepo } from "../db/handleRepo";
import { playlistRepo } from "../db/playlistRepo";
import { trackRepo } from "../db/trackRepo";
import type { Playlist, TrackMeta } from "../db/types";
import {
  ensureReadPermission,
  type AudioImportCandidate,
  getRememberedFolderName,
  getRememberedLibraryDirectory,
  normalizeAudioFiles,
  pickAudioDirectory,
  readAudioMetadata,
  rememberFolderName,
  scanAudioDirectory
} from "../lib/fileAccess";
import { chunkArray, mapWithConcurrency, yieldToUI } from "../lib/importer";

export type RepeatMode = "off" | "one" | "all";
export type ImportMode = "folder" | "files" | "update";
export type ImportStatus = "idle" | "running" | "done" | "error";

const DEFAULT_IMPORT_CHUNK_SIZE = 100;
const DEFAULT_IMPORT_CONCURRENCY = 4;
const MAX_IMPORT_FAILURES = 50;
const LAST_IMPORT_MODE_KEY = "library-last-import-mode";
const HAS_IMPORTED_BEFORE_KEY = "library-has-imported-before";

const EMPTY_IMPORT_PROGRESS: ImportProgressState = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0
};

const stripExtension = (name: string) => name.replace(/\.[^.]+$/, "");

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

const toFailureReason = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
};

const limitFailures = (current: ImportFailure[], incoming: ImportFailure[]) => {
  if (incoming.length === 0) return current;
  return [...current, ...incoming].slice(0, MAX_IMPORT_FAILURES);
};

const revokeTrackCoverIfBlob = (track: TrackMeta) => {
  if (track.coverUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(track.coverUrl);
  }
};

export interface ImportFailure {
  fileName: string;
  reason: string;
}

export interface ImportProgressState {
  total: number;
  processed: number;
  succeeded: number;
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
  importStatus: ImportStatus;
  importProgress: ImportProgressState;
  importFailures: ImportFailure[];
  importLastMessage: string;
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
  resetImportState: () => void;
  loadLibrary: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  updatePlaylist: (playlist: Playlist) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  importFilesChunked: (
    files: File[],
    opts?: {
      mode?: ImportMode;
      candidates?: AudioImportCandidate[];
      handles?: (FileSystemFileHandle | undefined)[];
      autoImport?: boolean;
      chunkSize?: number;
      concurrency?: number;
      signal?: AbortSignal;
    }
  ) => Promise<ImportResult>;
  importPickedFiles: (
    files: File[],
    opts?: {
      mode?: ImportMode;
      candidates?: AudioImportCandidate[];
      handles?: (FileSystemFileHandle | undefined)[];
      autoImport?: boolean;
      chunkSize?: number;
      concurrency?: number;
      signal?: AbortSignal;
    }
  ) => Promise<ImportResult>;
  rescanLibrary: (options?: {
    autoImport?: boolean;
    chunkSize?: number;
    concurrency?: number;
    signal?: AbortSignal;
  }) => Promise<ImportResult>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  playlists: [],
  lastImportMode: readLastImportMode(),
  hasImportedBefore: localStorage.getItem(HAS_IMPORTED_BEFORE_KEY) === "true",
  importStatus: "idle",
  importProgress: EMPTY_IMPORT_PROGRESS,
  importFailures: [],
  importLastMessage: "",
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
    void trackRepo.delete(id).catch(() => {
      // Ignore delete failures to avoid crashing playback state updates.
    });
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
  resetImportState: () => {
    set({
      importStatus: "idle",
      importProgress: EMPTY_IMPORT_PROGRESS,
      importFailures: [],
      importLastMessage: ""
    });
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
  importFilesChunked: async (files, opts) => {
    const candidates = opts?.candidates || normalizeAudioFiles(files, opts?.handles);
    const chunkSize = opts?.chunkSize ?? DEFAULT_IMPORT_CHUNK_SIZE;
    const concurrency = opts?.concurrency ?? DEFAULT_IMPORT_CONCURRENCY;

    set({
      importStatus: "running",
      importProgress: {
        total: candidates.length,
        processed: 0,
        succeeded: 0,
        failed: 0
      },
      importFailures: [],
      importLastMessage: candidates.length ? "Preparing import..." : "No files to import."
    });

    if (candidates.length === 0) {
      set({
        importStatus: "done",
        importLastMessage: "No files to import.",
        importProgress: {
          total: 0,
          processed: 0,
          succeeded: 0,
          failed: 0
        }
      });
      return { total: 0, imported: 0, skipped: 0, failed: 0 };
    }

    try {
      const existingTracks = await trackRepo.getAll();
      const signatures = new Set(existingTracks.map(getTrackSignature).filter(Boolean) as string[]);

      const queue: AudioImportCandidate[] = [];
      let skipped = 0;

      for (const candidate of candidates) {
        if (signatures.has(candidate.signature)) {
          skipped += 1;
          continue;
        }
        signatures.add(candidate.signature);
        queue.push(candidate);
      }

      let processed = skipped;
      let succeeded = 0;
      let failed = 0;
      let failures: ImportFailure[] = [];

      set({
        importProgress: {
          total: candidates.length,
          processed,
          succeeded,
          failed
        },
        importLastMessage: `Importing ${processed}/${candidates.length}`
      });

      const chunks = chunkArray(queue, chunkSize);

      for (const chunk of chunks) {
        if (opts?.signal?.aborted) {
          const result: ImportResult = {
            total: candidates.length,
            imported: succeeded,
            skipped,
            failed,
            canceled: true
          };
          set({
            importStatus: "done",
            importLastMessage: `Import canceled. Added ${succeeded}, failed ${failed}.`,
            importProgress: {
              total: candidates.length,
              processed,
              succeeded,
              failed
            },
            importFailures: failures
          });
          return result;
        }

        const chunkResults = await mapWithConcurrency(chunk, concurrency, async (candidate) => {
          const fallbackTitle = stripExtension(candidate.file.name) || candidate.file.name;

          try {
            let metadata: Awaited<ReturnType<typeof readAudioMetadata>>;
            try {
              metadata = await readAudioMetadata(candidate.file);
            } catch {
              metadata = {
                title: fallbackTitle,
                artist: "Unknown",
                album: undefined,
                duration: 0,
                coverUrl: undefined
              };
            }

            let handleId: string | undefined;
            if (candidate.handle) {
              try {
                const storedHandle = await handleRepo.save(candidate.handle, { purpose: "track" });
                handleId = storedHandle.id;
              } catch {
                handleId = undefined;
              }
            }

            const track: TrackMeta = {
              id: crypto.randomUUID(),
              title: metadata.title?.trim() || fallbackTitle,
              artist: metadata.artist?.trim() || "Unknown",
              album: metadata.album,
              duration:
                typeof metadata.duration === "number" && Number.isFinite(metadata.duration)
                  ? metadata.duration
                  : 0,
              coverUrl: metadata.coverUrl,
              lastModified: candidate.file.lastModified,
              size: candidate.file.size,
              sourcePath: candidate.sourcePath,
              signature: candidate.signature,
              addedAt: Date.now(),
              source: handleId ? "handle" : "file",
              handleId
            };

            if (opts?.autoImport || !candidate.handle || !handleId) {
              track.source = "blob";
              track.blob = candidate.file;
              track.handleId = undefined;
            }

            return { candidate, track } as const;
          } catch (error) {
            return {
              candidate,
              failure: {
                fileName: candidate.file.name,
                reason: toFailureReason(error)
              }
            } as const;
          }
        });

        const tracksToSave: Array<{ track: TrackMeta; fileName: string }> = [];
        const chunkFailures: ImportFailure[] = [];

        for (const item of chunkResults) {
          if (!item) {
            continue;
          }
          if ("track" in item && item.track) {
            tracksToSave.push({ track: item.track, fileName: item.candidate.file.name });
          } else if ("failure" in item && item.failure) {
            chunkFailures.push(item.failure);
          }
        }

        let writeError: unknown = null;
        if (tracksToSave.length > 0) {
          const tracksForDb = tracksToSave.map((item) => item.track);
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await trackRepo.upsertAll(tracksForDb);
              writeError = null;
              break;
            } catch (error) {
              writeError = error;
              if (attempt === 0) await yieldToUI();
            }
          }
        }

        if (writeError) {
          for (const item of tracksToSave) {
            revokeTrackCoverIfBlob(item.track);
          }
          chunkFailures.push(
            ...tracksToSave.map((item) => ({
              fileName: item.fileName,
              reason: `Chunk write failed: ${toFailureReason(writeError)}`
            }))
          );
        } else if (tracksToSave.length > 0) {
          set({ tracks: [...tracksToSave.map((item) => item.track), ...get().tracks] });
          succeeded += tracksToSave.length;
        }

        failed += chunkFailures.length;
        failures = limitFailures(failures, chunkFailures);
        processed += chunk.length;

        set({
          importProgress: {
            total: candidates.length,
            processed,
            succeeded,
            failed
          },
          importFailures: failures,
          importLastMessage: `Importing ${processed}/${candidates.length}`
        });

        await yieldToUI();
      }

      const result: ImportResult = {
        total: candidates.length,
        imported: succeeded,
        skipped,
        failed
      };

      if (opts?.mode === "folder" || opts?.mode === "files") {
        persistImportMode(opts.mode);
        set({ lastImportMode: opts.mode });
      }
      if (result.imported > 0) {
        localStorage.setItem(HAS_IMPORTED_BEFORE_KEY, "true");
        set({ hasImportedBefore: true });
      }

      set({
        importStatus: "done",
        importLastMessage: `Added ${result.imported} tracks, failed ${result.failed}.`,
        importProgress: {
          total: candidates.length,
          processed: candidates.length,
          succeeded,
          failed
        },
        importFailures: failures
      });

      return result;
    } catch (error) {
      set({
        importStatus: "error",
        importLastMessage: `Import failed: ${toFailureReason(error)}`
      });
      throw error;
    }
  },
  importPickedFiles: async (files, opts) => {
    return get().importFilesChunked(files, opts);
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

    const result = await get().importFilesChunked([], {
      candidates,
      mode: "update",
      autoImport: options?.autoImport,
      chunkSize: options?.chunkSize,
      concurrency: options?.concurrency,
      signal: options?.signal
    });

    if (!result.canceled) {
      persistImportMode("folder");
      set({ lastImportMode: "folder" });
    }

    return {
      ...result,
      warning
    };
  }
}));
