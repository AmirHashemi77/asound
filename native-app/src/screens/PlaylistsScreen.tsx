import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { audioEngine } from "../audio/AudioEngine";
import { hydratePlaylistTrackMap, playlistRepo, playlistTrackRepo } from "../database/database";
import { PlaylistItem } from "../components/PlaylistItem";
import { usePlayerStore } from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";
import type { Track } from "../utils/types";

export const PlaylistsScreen = () => {
  const { tracks } = usePlayerStore();
  const {
    playlists,
    playlistTrackMap,
    selectedPlaylistId,
    setPlaylists,
    setPlaylistTrackMap,
    setPlaylistTracks,
    setSelectedPlaylistId,
    upsertPlaylist,
    removePlaylist
  } = usePlaylistStore();

  const [name, setName] = useState("");

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);

  const selectedTrackIds = selectedPlaylistId ? playlistTrackMap[selectedPlaylistId] ?? [] : [];
  const selectedTracks = selectedTrackIds.map((id) => trackById.get(id)).filter(Boolean) as Track[];

  const refresh = useCallback(async () => {
    try {
      const allPlaylists = await playlistRepo.getAll();
      setPlaylists(allPlaylists);
      const map = await hydratePlaylistTrackMap(allPlaylists.map((item) => item.id));
      setPlaylistTrackMap(map);

      if (!selectedPlaylistId && allPlaylists.length > 0) {
        setSelectedPlaylistId(allPlaylists[0].id);
      }
    } catch {
      // Keep screen stable.
    }
  }, [selectedPlaylistId, setPlaylistTrackMap, setPlaylists, setSelectedPlaylistId]);

  const persistTracks = useCallback(
    async (nextTrackIds: string[]) => {
      if (!selectedPlaylistId) return;
      try {
        await playlistTrackRepo.replace(selectedPlaylistId, nextTrackIds);
        setPlaylistTracks(selectedPlaylistId, nextTrackIds);
      } catch {
        Alert.alert("Error", "Failed to update playlist tracks.");
      }
    },
    [selectedPlaylistId, setPlaylistTracks]
  );

  const onCreatePlaylist = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      const playlist = await playlistRepo.create(trimmed);
      upsertPlaylist(playlist);
      setPlaylistTracks(playlist.id, []);
      setSelectedPlaylistId(playlist.id);
      setName("");
    } catch {
      Alert.alert("Error", "Failed to create playlist.");
    }
  };

  const onDeletePlaylist = async () => {
    if (!selectedPlaylistId) return;

    try {
      await playlistRepo.remove(selectedPlaylistId);
      removePlaylist(selectedPlaylistId);
    } catch {
      Alert.alert("Error", "Failed to delete playlist.");
    }
  };

  const onPlayPlaylist = async () => {
    if (selectedTracks.length === 0) return;

    try {
      audioEngine.setQueue(selectedTracks.map((track) => track.id));
      await audioEngine.load(selectedTracks[0], true);
    } catch {
      Alert.alert("Error", "Failed to start playlist playback.");
    }
  };

  const addTrackToPlaylist = async (trackId: string) => {
    if (!selectedPlaylistId) return;
    if (selectedTrackIds.includes(trackId)) return;

    const next = [...selectedTrackIds, trackId];
    await persistTracks(next);
  };

  const moveTrack = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedTrackIds.length) return;

    const next = [...selectedTrackIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    await persistTracks(next);
  };

  const removeTrackFromPlaylist = async (trackId: string) => {
    const next = selectedTrackIds.filter((id) => id !== trackId);
    await persistTracks(next);
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Playlists</Text>

      <View style={styles.createRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New playlist name"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Pressable style={styles.primaryButton} onPress={() => void onCreatePlaylist()}>
          <Text style={styles.primaryText}>Create</Text>
        </Pressable>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlaylistItem
            playlist={item}
            trackCount={(playlistTrackMap[item.id] ?? []).length}
            active={item.id === selectedPlaylistId}
            onPress={() => setSelectedPlaylistId(item.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No playlists yet.</Text>}
        style={styles.playlistList}
      />

      {selectedPlaylistId ? (
        <ScrollView style={styles.details} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.detailActions}>
            <Pressable style={styles.primaryButton} onPress={() => void onPlayPlaylist()}>
              <Text style={styles.primaryText}>Play Playlist</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={() => void onDeletePlaylist()}>
              <Text style={styles.dangerText}>Delete</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Playlist Tracks</Text>
          {selectedTracks.length === 0 ? <Text style={styles.empty}>No tracks in this playlist.</Text> : null}

          {selectedTracks.map((track, index) => (
            <View key={track.id} style={styles.trackRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
              <View style={styles.rowActions}>
                <Pressable style={styles.rowButton} onPress={() => void moveTrack(index, -1)}>
                  <Text style={styles.rowButtonText}>↑</Text>
                </Pressable>
                <Pressable style={styles.rowButton} onPress={() => void moveTrack(index, 1)}>
                  <Text style={styles.rowButtonText}>↓</Text>
                </Pressable>
                <Pressable style={styles.rowButton} onPress={() => void removeTrackFromPlaylist(track.id)}>
                  <Text style={styles.rowButtonText}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Add From Library</Text>
          {tracks.map((track) => {
            const alreadyAdded = selectedTrackIds.includes(track.id);
            return (
              <View style={styles.trackRow} key={`library-${track.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
                <Pressable
                  style={[styles.rowButton, alreadyAdded && styles.disabledButton]}
                  disabled={alreadyAdded}
                  onPress={() => void addTrackToPlaylist(track.id)}
                >
                  <Text style={styles.rowButtonText}>{alreadyAdded ? "✓" : "+"}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800"
  },
  createRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#f8fafc",
    backgroundColor: "#0f172a"
  },
  playlistList: {
    marginTop: 14,
    maxHeight: 220
  },
  details: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1e293b",
    paddingTop: 12
  },
  detailActions: {
    flexDirection: "row",
    gap: 8
  },
  primaryButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  primaryText: {
    color: "#082f49",
    fontWeight: "800"
  },
  dangerButton: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dangerText: {
    color: "#fecaca",
    fontWeight: "700"
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: "#f8fafc",
    fontWeight: "700"
  },
  empty: {
    color: "#94a3b8",
    marginVertical: 8
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e293b",
    gap: 8
  },
  trackTitle: {
    color: "#e2e8f0",
    fontWeight: "600"
  },
  trackArtist: {
    color: "#94a3b8",
    marginTop: 2
  },
  rowActions: {
    flexDirection: "row",
    gap: 6
  },
  rowButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 999,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  rowButtonText: {
    color: "#e2e8f0",
    fontWeight: "700"
  },
  disabledButton: {
    opacity: 0.5
  }
});
