import { useEffect, useMemo, useRef } from "react";
import { getAudio, resolveTrackSrc } from "../lib/audioEngine";
import { setupMediaSession, setMediaSessionHandlers } from "../lib/mediaSession";
import { releaseWakeLock, requestWakeLock } from "../lib/wakeLock";
import { usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useAudioEngine = () => {
  const {
    tracks,
    currentTrackId,
    isPlaying,
    repeat,
    shuffle,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setCurrent
  } = usePlayerStore();
  const { volume } = useSettings();
  const audio = useMemo(() => getAudio(), []);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSyncedTimeRef = useRef(0);

  const currentTrack = tracks.find((track) => track.id === currentTrackId) || null;

  const shuffleOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!shuffle) return;
    const ids = [...tracks.map((track) => track.id)];
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    shuffleOrderRef.current = ids;
  }, [shuffle, tracks]);

  const orderedTrackIds = useMemo(() => {
    if (!shuffle) return tracks.map((track) => track.id);
    return shuffleOrderRef.current.length ? shuffleOrderRef.current : tracks.map((track) => track.id);
  }, [tracks, shuffle]);

  const seek = (value: number) => {
    audio.currentTime = clamp(value, 0, audio.duration || 0);
    lastSyncedTimeRef.current = audio.currentTime;
    setCurrentTime(audio.currentTime);
  };

  const play = async () => {
    try {
      await audio.play();
      setIsPlaying(true);
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      await requestWakeLock();
    } catch {
      setIsPlaying(false);
    }
  };

  const pause = async () => {
    audio.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    await releaseWakeLock();
  };

  const playNext = async () => {
    if (!currentTrackId) return;
    const index = orderedTrackIds.indexOf(currentTrackId);
    if (index === -1) return;
    const nextId = orderedTrackIds[index + 1];
    if (nextId) {
      setCurrent(nextId);
      return;
    }
    if (repeat === "all" && orderedTrackIds.length > 0) {
      setCurrent(orderedTrackIds[0]);
    }
  };

  const playPrev = () => {
    if (!currentTrackId) return;
    const index = orderedTrackIds.indexOf(currentTrackId);
    if (index === -1) return;
    const prevId = orderedTrackIds[index - 1];
    if (prevId) {
      setCurrent(prevId);
      return;
    }
    if (repeat === "all" && orderedTrackIds.length > 0) {
      setCurrent(orderedTrackIds[orderedTrackIds.length - 1]);
    }
  };

  useEffect(() => {
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    setMediaSessionHandlers({
      onPlay: play,
      onPause: pause,
      onNext: playNext,
      onPrev: playPrev,
      onSeek: seek
    });
  });

  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (repeat === "one") {
        seek(0);
        play();
        return;
      }
      playNext();
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audio, repeat, playNext]);

  useEffect(() => {
    const cancel = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    if (!isPlaying || !currentTrackId) {
      cancel();
      return;
    }

    const sync = () => {
      const nextTime = audio.currentTime || 0;
      if (Math.abs(nextTime - lastSyncedTimeRef.current) >= 0.012) {
        lastSyncedTimeRef.current = nextTime;
        setCurrentTime(nextTime);
      }
      rafRef.current = requestAnimationFrame(sync);
    };

    rafRef.current = requestAnimationFrame(sync);
    return cancel;
  }, [audio, currentTrackId, isPlaying, setCurrentTime]);

  useEffect(() => {
    if (!currentTrack) return;

    const load = async () => {
      const src = await resolveTrackSrc(currentTrack);
      if (!src) return;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = src;
      audio.src = src;
      lastSyncedTimeRef.current = 0;
      setCurrentTime(0);
      setupMediaSession(currentTrack);
      if (isPlaying) {
        await play();
      }
    };

    load();
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [currentTrackId]);

  useEffect(() => {
    if (isPlaying) {
      play();
    } else {
      pause();
    }
  }, [isPlaying]);

  return {
    audio,
    currentTrack,
    play,
    pause,
    playNext,
    playPrev,
    seek
  };
};
