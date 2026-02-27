import { AppState } from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid, type AVPlaybackStatus, type AVPlaybackStatusSuccess } from "expo-av";
import { usePlayerStore } from "../store/playerStore";
import type { Track } from "../utils/types";

class AudioEngine {
  private static instance: AudioEngine;

  private sound: Audio.Sound | null = null;
  private initialized = false;
  private currentTrack: Track | null = null;

  private constructor() {}

  static getInstance() {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }

    return AudioEngine.instance;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        allowsRecordingIOS: false
      });

      await this.ensureSound();

      AppState.addEventListener("change", () => {
        void this.syncStatus();
      });

      this.initialized = true;
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Failed to initialize audio engine.");
    }
  }

  async load(track: Track, shouldPlay = true) {
    try {
      await this.initialize();
      const sound = await this.ensureSound();

      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.unloadAsync();
      }

      this.currentTrack = track;
      usePlayerStore.getState().setCurrentTrackId(track.id);
      usePlayerStore.getState().setNowPlayingMetadata({
        title: track.title,
        artist: track.artist,
        artworkUri: track.artworkUri
      });

      await sound.loadAsync(
        { uri: track.uri },
        {
          shouldPlay,
          progressUpdateIntervalMillis: 500
        }
      );

      if (shouldPlay) {
        await sound.playAsync();
      }

      await this.syncStatus();
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Failed to load track.");
    }
  }

  async play() {
    try {
      const sound = await this.ensureSound();
      const status = await sound.getStatusAsync();

      if (!status.isLoaded) {
        const trackId = usePlayerStore.getState().currentTrackId;
        const track = usePlayerStore.getState().tracks.find((item) => item.id === trackId);

        if (track) {
          await this.load(track, true);
          return;
        }

        return;
      }

      await sound.playAsync();
      await this.syncStatus();
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Failed to play audio.");
    }
  }

  async pause() {
    try {
      const sound = await this.ensureSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      await sound.pauseAsync();
      await this.syncStatus();
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Failed to pause audio.");
    }
  }

  async stop() {
    try {
      const sound = await this.ensureSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      await sound.stopAsync();
      await this.syncStatus();
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Failed to stop audio.");
    }
  }

  async seek(positionMillis: number) {
    try {
      const sound = await this.ensureSound();
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      await sound.setPositionAsync(Math.max(0, positionMillis));
      await this.syncStatus();
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Failed to seek audio.");
    }
  }

  async next() {
    const { queueTrackIds, tracks, currentTrackId } = usePlayerStore.getState();
    if (queueTrackIds.length === 0) return;

    const index = queueTrackIds.findIndex((id) => id === currentTrackId);
    const nextIndex = index >= 0 && index < queueTrackIds.length - 1 ? index + 1 : 0;
    const nextTrack = tracks.find((track) => track.id === queueTrackIds[nextIndex]);

    if (nextTrack) {
      await this.load(nextTrack, true);
    }
  }

  async previous() {
    const { queueTrackIds, tracks, currentTrackId, positionMillis } = usePlayerStore.getState();
    if (queueTrackIds.length === 0) return;

    if (positionMillis > 3000) {
      await this.seek(0);
      return;
    }

    const index = queueTrackIds.findIndex((id) => id === currentTrackId);
    const prevIndex = index > 0 ? index - 1 : queueTrackIds.length - 1;
    const prevTrack = tracks.find((track) => track.id === queueTrackIds[prevIndex]);

    if (prevTrack) {
      await this.load(prevTrack, true);
    }
  }

  setQueue(trackIds: string[]) {
    usePlayerStore.getState().setQueue(trackIds);
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  private async ensureSound() {
    if (this.sound) return this.sound;

    const sound = new Audio.Sound();
    sound.setOnPlaybackStatusUpdate((status) => {
      this.handlePlaybackStatus(status);
    });

    sound.setOnMetadataUpdate((metadata) => {
      const currentTrackId = usePlayerStore.getState().currentTrackId;
      const track = usePlayerStore.getState().tracks.find((item) => item.id === currentTrackId);

      usePlayerStore.getState().setNowPlayingMetadata({
        title: String(metadata?.title ?? track?.title ?? "Unknown Title"),
        artist: String(track?.artist ?? "Unknown Artist"),
        artworkUri: track?.artworkUri ?? null
      });
    });

    this.sound = sound;
    return sound;
  }

  private async syncStatus() {
    if (!this.sound) return;

    try {
      const status = await this.sound.getStatusAsync();
      this.handlePlaybackStatus(status);
    } catch (error) {
      usePlayerStore.getState().setError(error instanceof Error ? error.message : "Unable to sync playback state.");
    }
  }

  private handlePlaybackStatus(status: AVPlaybackStatus) {
    usePlayerStore.getState().setPlaybackStatus(status);

    if (!status.isLoaded) {
      return;
    }

    const loadedStatus = status as AVPlaybackStatusSuccess;

    if (loadedStatus.didJustFinish) {
      void this.next();
    }
  }
}

export const audioEngine = AudioEngine.getInstance();
