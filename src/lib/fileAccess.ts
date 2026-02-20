import { parseBlob } from "music-metadata-browser";
import type { TrackMeta } from "../db/types";
import { handleRepo } from "../db/handleRepo";

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".opus", ".alac"];
type DirectoryHandleWithIterators = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
};

export const supportsFileSystemAccess = () =>
  "showOpenFilePicker" in window && typeof window.showOpenFilePicker === "function";

export const supportsDirectoryAccess = () =>
  "showDirectoryPicker" in window && typeof window.showDirectoryPicker === "function";

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
    const parts = base.split(separator).map((part) => part.trim()).filter(Boolean);
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

export const pickAudioFiles = async (): Promise<{
  files: File[];
  handles?: FileSystemFileHandle[];
}> => {
  const openPicker = window.showOpenFilePicker;
  if (typeof openPicker === "function") {
    const handles = await openPicker({
      multiple: true,
      types: [
        {
          description: "Audio",
          accept: {
            "audio/*": [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"]
          }
        }
      ]
    });
    const files = await Promise.all(handles.map((handle) => handle.getFile()));
    return { files, handles };
  }
  return { files: [] };
};

const walkDirectory = async (
  directory: FileSystemDirectoryHandle,
  files: File[],
  handles: FileSystemFileHandle[]
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
    if (entry.kind === "directory") {
      await walkDirectory(entry as FileSystemDirectoryHandle, files, handles);
      continue;
    }
    const fileHandle = entry as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    if (!isAudioFileName(file.name)) continue;
    files.push(file);
    handles.push(fileHandle);
  }
};

export const pickAudioDirectory = async (): Promise<{
  files: File[];
  handles: FileSystemFileHandle[];
}> => {
  const openDirectoryPicker = window.showDirectoryPicker;
  if (typeof openDirectoryPicker !== "function") {
    return { files: [], handles: [] };
  }

  const root = await openDirectoryPicker({ mode: "read", startIn: "music" });
  const files: File[] = [];
  const handles: FileSystemFileHandle[] = [];
  await walkDirectory(root, files, handles);
  return { files, handles };
};

export const extractTrackMeta = async (
  file: File,
  handle?: FileSystemFileHandle
): Promise<TrackMeta> => {
  const { title, artist, album, duration, coverUrl } = await readAudioMetadata(file);

  let handleId: string | undefined;
  if (handle) {
    const stored = await handleRepo.save(handle);
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
    addedAt: Date.now(),
    source: handle ? "handle" : "file",
    handleId
  };
};
