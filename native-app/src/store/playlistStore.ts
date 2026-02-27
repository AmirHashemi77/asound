import { create } from "zustand";
import type { Playlist } from "../utils/types";

type PlaylistStore = {
  playlists: Playlist[];
  playlistTrackMap: Record<string, string[]>;
  selectedPlaylistId: string | null;
  setPlaylists: (playlists: Playlist[]) => void;
  upsertPlaylist: (playlist: Playlist) => void;
  removePlaylist: (playlistId: string) => void;
  setPlaylistTracks: (playlistId: string, trackIds: string[]) => void;
  setPlaylistTrackMap: (map: Record<string, string[]>) => void;
  setSelectedPlaylistId: (playlistId: string | null) => void;
};

export const usePlaylistStore = create<PlaylistStore>((set) => ({
  playlists: [],
  playlistTrackMap: {},
  selectedPlaylistId: null,

  setPlaylists: (playlists) =>
    set({
      playlists: playlists.sort((a, b) => b.createdAt - a.createdAt)
    }),

  upsertPlaylist: (playlist) =>
    set((state) => {
      const others = state.playlists.filter((entry) => entry.id !== playlist.id);
      return {
        playlists: [playlist, ...others].sort((a, b) => b.createdAt - a.createdAt)
      };
    }),

  removePlaylist: (playlistId) =>
    set((state) => {
      const nextMap = { ...state.playlistTrackMap };
      delete nextMap[playlistId];

      return {
        playlists: state.playlists.filter((playlist) => playlist.id !== playlistId),
        playlistTrackMap: nextMap,
        selectedPlaylistId: state.selectedPlaylistId === playlistId ? null : state.selectedPlaylistId
      };
    }),

  setPlaylistTracks: (playlistId, trackIds) =>
    set((state) => ({
      playlistTrackMap: {
        ...state.playlistTrackMap,
        [playlistId]: trackIds
      }
    })),

  setPlaylistTrackMap: (playlistTrackMap) => set({ playlistTrackMap }),

  setSelectedPlaylistId: (selectedPlaylistId) => set({ selectedPlaylistId })
}));
