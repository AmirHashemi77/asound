import type { TrackMeta } from "../db/types";
import { handleRepo } from "../db/handleRepo";

let audio: HTMLAudioElement | null = null;

const emitAudioLifecycleEvent = (name: "play" | "pause" | "play-error") => {
  window.dispatchEvent(new CustomEvent("asound:audio-lifecycle", { detail: { name } }));
};

export const getAudio = () => {
  if (!audio) {
    audio = new Audio();
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
  }
  return audio;
};

export const safePlay = async (element: HTMLAudioElement) => {
  try {
    await element.play();
    emitAudioLifecycleEvent("play");
    return true;
  } catch {
    emitAudioLifecycleEvent("play-error");
    return false;
  }
};

export const safePause = (element: HTMLAudioElement) => {
  try {
    element.pause();
    emitAudioLifecycleEvent("pause");
    return true;
  } catch {
    return false;
  }
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
