import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Playlist } from "../utils/types";

type PlaylistItemProps = {
  playlist: Playlist;
  trackCount: number;
  active: boolean;
  onPress: () => void;
};

export const PlaylistItem = ({ playlist, trackCount, active, onPress }: PlaylistItemProps) => {
  return (
    <Pressable onPress={onPress} style={[styles.container, active && styles.active]}>
      <View>
        <Text style={styles.title} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={styles.subtitle}>{trackCount} tracks</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10
  },
  active: {
    borderColor: "#38bdf8",
    backgroundColor: "#0b3a51"
  },
  title: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 2
  }
});
