import type { TrackMeta } from "../db/types";
import { handleRepo } from "../db/handleRepo";

let audio: HTMLAudioElement | null = null;

export const getAudio = () => {
  if (!audio) {
    audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
  }
  return audio;
};

export const resolveTrackSrc = async (track: TrackMeta): Promise<string | null> => {
  if (track.source === "blob" && track.blob) {
    return URL.createObjectURL(track.blob);
  }
  if (track.source === "file" && track.blob) {
    return URL.createObjectURL(track.blob);
  }
  if (track.source === "handle" && track.handleId) {
    const stored = await handleRepo.get(track.handleId);
    if (!stored || stored.kind !== "file") return null;
    const file = await (stored.handle as FileSystemFileHandle).getFile();
    return URL.createObjectURL(file);
  }
  return null;
};
