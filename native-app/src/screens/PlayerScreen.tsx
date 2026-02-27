import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { audioEngine } from "../audio/AudioEngine";
import { Waveform } from "../components/Waveform";
import { usePlayerStore } from "../store/playerStore";

const DEFAULT_COVER = require("../../assets/default-cover.png");

const formatMillis = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const PlayerScreen = () => {
  const { tracks, currentTrackId, isPlaying, positionMillis, durationMillis, lastError } = usePlayerStore();

  const track = useMemo(() => tracks.find((item) => item.id === currentTrackId) ?? null, [tracks, currentTrackId]);

  if (!track) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyTitle}>Nothing is playing</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={track.artworkUri ? { uri: track.artworkUri } : DEFAULT_COVER} style={styles.cover} contentFit="cover" />
      <Text style={styles.title}>{track.title}</Text>
      <Text style={styles.artist}>{track.artist || "Unknown Artist"}</Text>

      <Waveform />

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatMillis(positionMillis)}</Text>
        <Text style={styles.timeText}>{formatMillis(durationMillis)}</Text>
      </View>

      <View style={styles.controlsRow}>
        <Pressable onPress={() => void audioEngine.previous()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryLabel}>Prev</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (isPlaying) {
              void audioEngine.pause();
            } else {
              void audioEngine.play();
            }
          }}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryLabel}>{isPlaying ? "Pause" : "Play"}</Text>
        </Pressable>

        <Pressable onPress={() => void audioEngine.next()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryLabel}>Next</Text>
        </Pressable>
      </View>

      <View style={styles.seekRow}>
        <Pressable onPress={() => void audioEngine.seek(Math.max(0, positionMillis - 10000))} style={styles.secondaryBtn}>
          <Text style={styles.secondaryLabel}>-10s</Text>
        </Pressable>
        <Pressable onPress={() => void audioEngine.seek(positionMillis + 10000)} style={styles.secondaryBtn}>
          <Text style={styles.secondaryLabel}>+10s</Text>
        </Pressable>
      </View>

      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 140
  },
  center: {
    justifyContent: "center"
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700"
  },
  cover: {
    width: 280,
    height: 280,
    borderRadius: 20,
    backgroundColor: "#1f2937",
    marginTop: 24
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center"
  },
  artist: {
    color: "#94a3b8",
    fontSize: 15,
    marginTop: 6,
    textAlign: "center"
  },
  timeRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16
  },
  timeText: {
    color: "#94a3b8",
    fontSize: 13
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  primaryBtn: {
    backgroundColor: "#0ea5e9",
    borderRadius: 999,
    minWidth: 92,
    alignItems: "center",
    paddingVertical: 12
  },
  primaryLabel: {
    color: "#082f49",
    fontWeight: "800"
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 999,
    minWidth: 72,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  secondaryLabel: {
    color: "#cbd5e1",
    fontWeight: "600"
  },
  seekRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14
  },
  error: {
    color: "#fca5a5",
    marginTop: 18,
    textAlign: "center"
  }
});
