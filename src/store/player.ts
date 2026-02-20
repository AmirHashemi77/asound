import { create } from "zustand";
import type { Playlist, TrackMeta } from "../db/types";
import { handleRepo } from "../db/handleRepo";
import { playlistRepo } from "../db/playlistRepo";
import { trackRepo } from "../db/trackRepo";
import { readAudioMetadata } from "../lib/fileAccess";

export type RepeatMode = "off" | "one" | "all";

interface PlayerState {
  tracks: TrackMeta[];
  playlists: Playlist[];
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
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  playlists: [],
  currentTrackId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: "off",
  setTracks: (tracks) => set({ tracks }),
  addTracks: (tracks) => set({ tracks: [...tracks, ...get().tracks] }),
  removeTrack: (id) => set({ tracks: get().tracks.filter((track) => track.id !== id) }),
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
          if (stored) file = await stored.handle.getFile();
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
  }
}));
