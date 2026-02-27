import { useCallback, useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { audioEngine } from "../audio/AudioEngine";
import { trackRepo } from "../database/database";
import type { RootStackParamList } from "../navigation/types";
import { usePlayerStore } from "../store/playerStore";
import { TrackItem } from "../components/TrackItem";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const LibraryScreen = () => {
  const navigation = useNavigation<Nav>();
  const { tracks, currentTrackId, setTracks, setQueue, setCurrentTrackId } = usePlayerStore();

  const refresh = useCallback(async () => {
    try {
      const items = await trackRepo.getAll();
      setTracks(items);

      if (items.length > 0) {
        setQueue(items.map((item) => item.id));
        if (!currentTrackId) {
          setCurrentTrackId(items[0].id);
        }
      }
    } catch {
      // Keep UI functional even if fetch fails.
    }
  }, [currentTrackId, setCurrentTrackId, setQueue, setTracks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate("AddMusic")}>
            <Text style={styles.actionText}>Add Music</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate("Playlists")}>
            <Text style={styles.actionText}>Playlists</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            onPress={() => {
              audioEngine.setQueue(tracks.map((track) => track.id));
              void audioEngine.load(item, true);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No tracks yet</Text>
            <Text style={styles.emptySubtitle}>Use Add Music to import local audio files.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617"
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e293b"
  },
  title: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "800"
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  actionButton: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  actionText: {
    color: "#e2e8f0",
    fontWeight: "600"
  },
  list: {
    paddingBottom: 120
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 24
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700"
  },
  emptySubtitle: {
    marginTop: 6,
    color: "#94a3b8",
    textAlign: "center"
  }
});
