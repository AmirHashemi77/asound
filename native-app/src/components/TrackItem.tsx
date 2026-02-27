import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { Track } from "../utils/types";

type TrackItemProps = {
  track: Track;
  onPress: () => void;
};

const DEFAULT_COVER = require("../../assets/default-cover.png");

export const TrackItem = ({ track, onPress }: TrackItemProps) => {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Image source={track.artworkUri ? { uri: track.artworkUri } : DEFAULT_COVER} style={styles.cover} contentFit="cover" />
      <View style={styles.meta}>
        <Text numberOfLines={1} style={styles.title}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.artist}>
          {track.artist || "Unknown Artist"}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#263247"
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1f2937"
  },
  meta: {
    flex: 1
  },
  title: {
    color: "#f8fafc",
    fontWeight: "600",
    fontSize: 15
  },
  artist: {
    color: "#94a3b8",
    marginTop: 2
  }
});
