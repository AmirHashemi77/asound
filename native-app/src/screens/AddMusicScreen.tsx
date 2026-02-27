import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { audioEngine } from "../audio/AudioEngine";
import { trackRepo } from "../database/database";
import { usePlayerStore } from "../store/playerStore";
import { chunkArray, yieldToUI } from "../utils/chunk";
import { createId } from "../utils/id";
import { isLikelyAudioFile, probeDurationMillis, titleFromFilename } from "../utils/metadata";
import type { ImportProgress, Track } from "../utils/types";

const EMPTY_PROGRESS: ImportProgress = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0
};

export const AddMusicScreen = () => {
  const { tracks, prependTracks } = usePlayerStore();
  const [progress, setProgress] = useState<ImportProgress>(EMPTY_PROGRESS);
  const [running, setRunning] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const existingUris = useMemo(() => new Set(tracks.map((track) => track.uri)), [tracks]);

  const startImport = async () => {
    if (running) return;

    setResultMessage(null);

    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      multiple: true,
      copyToCacheDirectory: true
    });

    if (pickerResult.canceled) {
      return;
    }

    const assets = pickerResult.assets.filter((asset) => isLikelyAudioFile(asset.name, asset.mimeType));

    if (assets.length === 0) {
      Alert.alert("No audio files", "Please choose valid audio files.");
      return;
    }

    setRunning(true);
    setProgress({ ...EMPTY_PROGRESS, total: assets.length });

    const addedTracks: Track[] = [];
    const chunks = chunkArray(assets, 25);
    const knownUris = new Set(existingUris);
    let succeededCount = 0;
    let failedCount = 0;

    try {
      for (const chunk of chunks) {
        const chunkToPersist: Track[] = [];

        for (const asset of chunk) {
          try {
            if (knownUris.has(asset.uri)) {
              setProgress((prev) => ({
                ...prev,
                processed: prev.processed + 1
              }));
              continue;
            }

            const duration = await probeDurationMillis(asset.uri);

            const track: Track = {
              id: createId(),
              title: titleFromFilename(asset.name),
              artist: "Unknown Artist",
              uri: asset.uri,
              duration,
              artworkUri: null,
              createdAt: Date.now()
            };

            chunkToPersist.push(track);
            addedTracks.push(track);
            knownUris.add(asset.uri);
            succeededCount += 1;

            setProgress((prev) => ({
              ...prev,
              processed: prev.processed + 1,
              succeeded: prev.succeeded + 1
            }));
          } catch {
            failedCount += 1;
            setProgress((prev) => ({
              ...prev,
              processed: prev.processed + 1,
              failed: prev.failed + 1
            }));
          }
        }

        await trackRepo.saveMany(chunkToPersist);
        prependTracks(chunkToPersist);
        await yieldToUI();
      }

      if (addedTracks.length > 0) {
        audioEngine.setQueue(usePlayerStore.getState().tracks.map((track) => track.id));
      }

      setResultMessage(`Added ${addedTracks.length} tracks${failedCount > 0 ? `, ${failedCount} failed.` : "."}`);
    } catch (error) {
      setResultMessage(error instanceof Error ? error.message : "Import failed. Please try again.");
    } finally {
      setProgress((prev) => ({ ...prev, succeeded: succeededCount, failed: failedCount }));
      setRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Music</Text>
      <Text style={styles.subtitle}>Choose audio files from the Files app. Multiple selection is supported.</Text>

      <Pressable onPress={() => void startImport()} style={[styles.button, running && styles.buttonDisabled]} disabled={running}>
        <Text style={styles.buttonText}>{running ? "Importing..." : "Select Audio Files"}</Text>
      </Pressable>

      {progress.total > 0 ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressText}>
            Importing {progress.processed}/{progress.total}
          </Text>
          <Text style={styles.progressText}>Succeeded: {progress.succeeded}</Text>
          <Text style={styles.progressText}>Failed: {progress.failed}</Text>
        </View>
      ) : null}

      {resultMessage ? <Text style={styles.result}>{resultMessage}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
    paddingBottom: 120
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 8,
    lineHeight: 20
  },
  button: {
    marginTop: 20,
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 13
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: "#082f49",
    fontWeight: "800"
  },
  progressCard: {
    marginTop: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 14,
    gap: 4
  },
  progressText: {
    color: "#cbd5e1"
  },
  result: {
    marginTop: 12,
    color: "#e2e8f0"
  }
});
