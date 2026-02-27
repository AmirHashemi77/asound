import { parseBlob } from "music-metadata-browser";
import { handleRepo } from "../db/handleRepo";
import type { TrackMeta } from "../db/types";

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".opus", ".alac"];
const LIBRARY_ROOT_HANDLE_ID = "library-root-directory";
export const LIBRARY_LAST_FOLDER_NAME_KEY = "library-last-folder-name";

type DirectoryHandleWithIterators = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

export interface AudioImportCandidate {
  file: File;
  handle?: FileSystemFileHandle;
  sourcePath?: string;
  signature: string;
}

export const supportsFileSystemAccess = () =>
  "showOpenFilePicker" in window && typeof window.showOpenFilePicker === "function";

export const supportsDirectoryAccess = () =>
  "showDirectoryPicker" in window && typeof window.showDirectoryPicker === "function";

export const supportsWebkitDirectoryInput = () => {
  if (typeof document === "undefined") return false;
  const input = document.createElement("input") as HTMLInputElement & { webkitdirectory?: boolean };
  return "webkitdirectory" in input;
};

export const isAudioFileName = (fileName: string) => {
  const lowered = fileName.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lowered.endsWith(ext));
};

const stripExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

const cleanText = (value?: string | null) => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
};

const parseArtistTitleFromName = (fileName: string) => {
  const base = stripExtension(fileName).replace(/[_]+/g, " ").trim();
  const separators = [" - ", " – ", " — "];
  for (const separator of separators) {
    const parts = base
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return {
        artist: cleanText(parts[0]),
        title: cleanText(parts.slice(1).join(" - ")) || base
      };
    }
  }
  return { title: base };
};

const readDurationFromAudioTag = (file: File): Promise<number | undefined> =>
  new Promise((resolve) => {
    const audio = document.createElement("audio");
    const src = URL.createObjectURL(file);

    const cleanup = (duration?: number) => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(src);
      resolve(duration && Number.isFinite(duration) && duration > 0 ? duration : undefined);
    };

    const onLoaded = () => cleanup(audio.duration);
    const onError = () => cleanup();
    const timeoutId = window.setTimeout(() => cleanup(), 4500);

    audio.preload = "metadata";
    audio.src = src;
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });

export const readAudioMetadata = async (file: File) => {
  const fileNameFallback = parseArtistTitleFromName(file.name);
  let title = fileNameFallback.title || stripExtension(file.name);
  let artist = fileNameFallback.artist;
  let album: string | undefined;
  let duration: number | undefined;
  let coverUrl: string | undefined;

  try {
    const metadata = await parseBlob(file, { duration: true });
    title = cleanText(metadata.common.title) || title;
    artist = cleanText(metadata.common.artist) || artist;
    album = cleanText(metadata.common.album);
    duration = metadata.format.duration || undefined;

    const picture = metadata.common.picture?.[0];
    if (picture) {
      const blob = new Blob([picture.data], { type: picture.format });
      coverUrl = URL.createObjectURL(blob);
    }
  } catch {
    // Keep fallback meta.
  }

  if (!duration) {
    duration = await readDurationFromAudioTag(file);
  }

  return { title, artist, album, duration, coverUrl };
};

const getWebkitRelativePath = (file: File) => {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!relativePath) return undefined;
  const normalized = relativePath.trim().replace(/^\/+/, "");
  return normalized || undefined;
};

export const buildFileSignature = (
  file: Pick<File, "name" | "size" | "lastModified">,
  sourcePath?: string
) => {
  const identity = (sourcePath || file.name).trim().toLowerCase();
  return `${identity}::${file.size}::${file.lastModified}`;
};

const toCandidate = (
  file: File,
  options?: { handle?: FileSystemFileHandle; sourcePath?: string }
): AudioImportCandidate => {
  const sourcePath = options?.sourcePath || getWebkitRelativePath(file);
  return {
    file,
    handle: options?.handle,
    sourcePath,
    signature: buildFileSignature(file, sourcePath)
  };
};

export const normalizeAudioFiles = (
  files: File[],
  handles?: (FileSystemFileHandle | undefined)[]
): AudioImportCandidate[] => {
  const candidates: AudioImportCandidate[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (!isAudioFileName(file.name) && !file.type.startsWith("audio/")) continue;
    candidates.push(toCandidate(file, { handle: handles?.[i] }));
  }
  return candidates;
};

export const pickAudioFiles = async (): Promise<AudioImportCandidate[]> => {
  const openPicker = window.showOpenFilePicker;
  if (typeof openPicker !== "function") {
    return [];
  }

  const handles = await openPicker({
    multiple: true,
    types: [
      {
        description: "Audio",
        accept: {
          "audio/*": AUDIO_EXTENSIONS
        }
      }
    ]
  });
  const files = await Promise.all(handles.map((handle) => handle.getFile()));
  return normalizeAudioFiles(files, handles);
};

const walkDirectory = async (
  directory: FileSystemDirectoryHandle,
  rootName: string,
  candidates: AudioImportCandidate[],
  parentPath = ""
) => {
  const iterableDirectory = directory as DirectoryHandleWithIterators;

  let iterator: AsyncIterable<FileSystemHandle> | null = null;
  if (typeof iterableDirectory.values === "function") {
    iterator = iterableDirectory.values();
  } else if (typeof iterableDirectory.entries === "function") {
    iterator = (async function* () {
      for await (const [, handle] of iterableDirectory.entries!()) {
        yield handle;
      }
    })();
  } else if (Symbol.asyncIterator in directory) {
    iterator = directory as unknown as AsyncIterable<FileSystemHandle>;
  }

  if (!iterator) return;

  for await (const entry of iterator) {
    const nextPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      await walkDirectory(entry as FileSystemDirectoryHandle, rootName, candidates, nextPath);
      continue;
    }

    const handle = entry as FileSystemFileHandle;
    const file = await handle.getFile();
    if (!isAudioFileName(file.name) && !file.type.startsWith("audio/")) continue;

    const sourcePath = `${rootName}/${nextPath}`;
    candidates.push(toCandidate(file, { handle, sourcePath }));
  }
};

export const scanAudioDirectory = async (
  rootHandle: FileSystemDirectoryHandle
): Promise<AudioImportCandidate[]> => {
  const candidates: AudioImportCandidate[] = [];
  await walkDirectory(rootHandle, rootHandle.name, candidates);
  return candidates;
};

export const pickAudioDirectory = async (): Promise<{
  rootHandle: FileSystemDirectoryHandle | null;
  files: AudioImportCandidate[];
}> => {
  const openDirectoryPicker = window.showDirectoryPicker;
  if (typeof openDirectoryPicker !== "function") {
    return { rootHandle: null, files: [] };
  }

  const rootHandle = await openDirectoryPicker({ mode: "read", startIn: "music" });
  const files = await scanAudioDirectory(rootHandle);
  await handleRepo.save(rootHandle, {
    id: LIBRARY_ROOT_HANDLE_ID,
    purpose: "library-root"
  });
  localStorage.setItem(LIBRARY_LAST_FOLDER_NAME_KEY, rootHandle.name);

  return { rootHandle, files };
};

export const getRememberedLibraryDirectory = async () => {
  const stored = await handleRepo.get(LIBRARY_ROOT_HANDLE_ID);
  if (!stored || stored.kind !== "directory") return null;
  return stored.handle as FileSystemDirectoryHandle;
};

export const ensureReadPermission = async (handle: FileSystemDirectoryHandle) => {
  const permissionHandle = handle as FileSystemDirectoryHandle & {
    queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<string>;
    requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<string>;
  };
  const queryPermission = permissionHandle.queryPermission;
  const requestPermission = permissionHandle.requestPermission;
  if (typeof queryPermission !== "function") return true;

  const descriptor = { mode: "read" as const };
  const current = await queryPermission.call(permissionHandle, descriptor);
  if (current === "granted") return true;
  if (typeof requestPermission !== "function") return false;
  const next = await requestPermission.call(permissionHandle, descriptor);
  return next === "granted";
};

export const getSourceRootName = (sourcePath?: string) => {
  if (!sourcePath) return null;
  const [root] = sourcePath.split("/").filter(Boolean);
  return root || null;
};

export const rememberFolderName = (folderName: string) => {
  localStorage.setItem(LIBRARY_LAST_FOLDER_NAME_KEY, folderName);
};

export const getRememberedFolderName = () => localStorage.getItem(LIBRARY_LAST_FOLDER_NAME_KEY);

export const extractTrackMeta = async (
  file: File,
  options?: {
    handle?: FileSystemFileHandle;
    sourcePath?: string;
    signature?: string;
  }
): Promise<TrackMeta> => {
  const { title, artist, album, duration, coverUrl } = await readAudioMetadata(file);

  let handleId: string | undefined;
  if (options?.handle) {
    const stored = await handleRepo.save(options.handle, { purpose: "track" });
    handleId = stored.id;
  }

  return {
    id: crypto.randomUUID(),
    title,
    artist,
    album,
    duration,
    lastModified: file.lastModified,
    size: file.size,
    coverUrl,
    sourcePath: options?.sourcePath,
    signature: options?.signature || buildFileSignature(file, options?.sourcePath),
    addedAt: Date.now(),
    source: options?.handle ? "handle" : "file",
    handleId
  };
};
