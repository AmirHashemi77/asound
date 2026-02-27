import "react-native-gesture-handler";
import "react-native-reanimated";

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { audioEngine } from "./src/audio/AudioEngine";
import { MiniPlayer } from "./src/components/MiniPlayer";
import { hydratePlaylistTrackMap, initDatabase, playlistRepo, trackRepo } from "./src/database/database";
import type { RootStackParamList } from "./src/navigation/types";
import { AddMusicScreen } from "./src/screens/AddMusicScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { PlayerScreen } from "./src/screens/PlayerScreen";
import { PlaylistsScreen } from "./src/screens/PlaylistsScreen";
import { usePlayerStore } from "./src/store/playerStore";
import { usePlaylistStore } from "./src/store/playlistStore";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await initDatabase();
        await audioEngine.initialize();

        const [tracks, playlists] = await Promise.all([trackRepo.getAll(), playlistRepo.getAll()]);
        if (!active) return;

        const player = usePlayerStore.getState();
        const playlistStore = usePlaylistStore.getState();

        player.setTracks(tracks);
        player.setQueue(tracks.map((track) => track.id));
        if (!player.currentTrackId && tracks.length > 0) {
          player.setCurrentTrackId(tracks[0].id);
        }

        playlistStore.setPlaylists(playlists);
        const map = await hydratePlaylistTrackMap(playlists.map((playlist) => playlist.id));
        if (!active) return;

        playlistStore.setPlaylistTrackMap(map);

        setReady(true);
      } catch (error) {
        if (!active) return;
        setBootError(error instanceof Error ? error.message : "Failed to start the app.");
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  if (!ready && !bootError) {
    return (
      <View style={[styles.center, styles.background]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingText}>Bootstrapping ASoundNative...</Text>
      </View>
    );
  }

  if (bootError) {
    return (
      <View style={[styles.center, styles.background]}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>Startup failed</Text>
        <Text style={styles.errorText}>{bootError}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NavigationContainer>
          <View style={styles.root}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: "#020617" },
                headerTintColor: "#f8fafc",
                headerShadowVisible: false,
                contentStyle: { backgroundColor: "#020617" }
              }}
            >
              <Stack.Screen name="Library" component={LibraryScreen} options={{ title: "ASound Native" }} />
              <Stack.Screen name="Player" component={PlayerScreen} options={{ title: "Now Playing" }} />
              <Stack.Screen name="AddMusic" component={AddMusicScreen} options={{ title: "Add Music" }} />
              <Stack.Screen name="Playlists" component={PlaylistsScreen} options={{ title: "Playlists" }} />
            </Stack.Navigator>
            <MiniPlayer />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020617"
  },
  background: {
    backgroundColor: "#020617"
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 12
  },
  errorTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700"
  },
  errorText: {
    color: "#fca5a5",
    textAlign: "center",
    marginTop: 8
  }
});
