import { create } from "zustand";
import type { AVPlaybackStatus, AVPlaybackStatusSuccess } from "expo-av";
import type { PlaybackMetadata, Track } from "../utils/types";

type PlayerStore = {
  tracks: Track[];
  currentTrackId: string | null;
  queueTrackIds: string[];
  isPlaying: boolean;
  isBuffering: boolean;
  positionMillis: number;
  durationMillis: number;
  lastError: string | null;
  nowPlayingMetadata: PlaybackMetadata | null;
  setTracks: (tracks: Track[]) => void;
  prependTracks: (tracks: Track[]) => void;
  setCurrentTrackId: (trackId: string | null) => void;
  setQueue: (trackIds: string[]) => void;
  setNowPlayingMetadata: (metadata: PlaybackMetadata | null) => void;
  setPlaybackStatus: (status: AVPlaybackStatus) => void;
  setError: (message: string | null) => void;
};

const mergeById = (incoming: Track[], existing: Track[]) => {
  const map = new Map<string, Track>();
  for (const track of [...incoming, ...existing]) {
    map.set(track.id, track);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  tracks: [],
  currentTrackId: null,
  queueTrackIds: [],
  isPlaying: false,
  isBuffering: false,
  positionMillis: 0,
  durationMillis: 0,
  lastError: null,
  nowPlayingMetadata: null,

  setTracks: (tracks) => set({ tracks: tracks.sort((a, b) => b.createdAt - a.createdAt) }),
  prependTracks: (tracks) => set((state) => ({ tracks: mergeById(tracks, state.tracks) })),

  setCurrentTrackId: (currentTrackId) => set({ currentTrackId }),

  setQueue: (queueTrackIds) => set({ queueTrackIds }),

  setNowPlayingMetadata: (nowPlayingMetadata) => set({ nowPlayingMetadata }),

  setPlaybackStatus: (status) => {
    if (!status.isLoaded) {
      set({
        isPlaying: false,
        isBuffering: false,
        positionMillis: 0,
        durationMillis: 0,
        lastError: status.error ?? "Audio is unavailable."
      });
      return;
    }

    const loadedStatus = status as AVPlaybackStatusSuccess;

    set({
      isPlaying: loadedStatus.isPlaying,
      isBuffering: loadedStatus.isBuffering,
      positionMillis: loadedStatus.positionMillis,
      durationMillis: loadedStatus.durationMillis ?? 0,
      lastError: null
    });
  },

  setError: (lastError) => set({ lastError })
}));
