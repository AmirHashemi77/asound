import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { audioEngine } from "../audio/AudioEngine";
import { usePlayerStore } from "../store/playerStore";
import type { RootStackParamList } from "../navigation/types";

const DEFAULT_COVER = require("../../assets/default-cover.png");

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const MiniPlayer = () => {
  const navigation = useNavigation<Nav>();
  const { currentTrackId, tracks, isPlaying } = usePlayerStore();

  const track = useMemo(() => tracks.find((item) => item.id === currentTrackId) ?? null, [tracks, currentTrackId]);
  if (!track) return null;

  return (
    <Pressable style={styles.wrapper} onPress={() => navigation.navigate("Player")}>
      <Image source={track.artworkUri ? { uri: track.artworkUri } : DEFAULT_COVER} style={styles.cover} contentFit="cover" />
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.artist}>
          {track.artist || "Unknown Artist"}
        </Text>
      </View>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          if (isPlaying) {
            void audioEngine.pause();
          } else {
            void audioEngine.play();
          }
        }}
        style={styles.playButton}
      >
        <Text style={styles.playLabel}>{isPlaying ? "Pause" : "Play"}</Text>
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#1f2937"
  },
  info: {
    flex: 1
  },
  title: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700"
  },
  artist: {
    color: "#94a3b8",
    marginTop: 2,
    fontSize: 12
  },
  playButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  playLabel: {
    color: "#082f49",
    fontWeight: "700",
    fontSize: 12
  }
});
