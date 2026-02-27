import { Audio } from "expo-av";

const STRIP_EXTENSION = /\.[^/.]+$/;

export const titleFromFilename = (name: string) => name.replace(STRIP_EXTENSION, "");

export const isLikelyAudioFile = (name: string, mimeType?: string | null) => {
  if (mimeType?.startsWith("audio/")) return true;

  const lower = name.toLowerCase();
  return [".mp3", ".m4a", ".wav", ".flac", ".aac", ".ogg", ".opus", ".aiff", ".caf"].some((ext) =>
    lower.endsWith(ext)
  );
};

export const probeDurationMillis = async (uri: string) => {
  const sound = new Audio.Sound();
  try {
    const status = await sound.loadAsync({ uri }, { shouldPlay: false });
    if (!status.isLoaded) return 0;
    return status.durationMillis ?? 0;
  } catch {
    return 0;
  } finally {
    try {
      await sound.unloadAsync();
    } catch {
      // Best effort cleanup.
    }
  }
};
