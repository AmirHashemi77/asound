import { useCallback, useEffect, useMemo, useRef } from "react";
import { getAudio, resolveTrackSrc, safePause, safePlay } from "../lib/audioEngine";
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
    lastKnownShouldBePlaying,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setCurrent,
    setLastKnownShouldBePlaying,
    reconcilePlaybackState: reconcilePlaybackFromStore,
    setPlaybackNotice
  } = usePlayerStore();
  const { volume } = useSettings();
  const audio = useMemo(() => getAudio(), []);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSyncedTimeRef = useRef(0);
  const rebindAudioListenersRef = useRef<(() => void) | null>(null);
  const shouldPlayRef = useRef(isPlaying);
  const shouldBePlayingRef = useRef(lastKnownShouldBePlaying);

  const currentTrack = tracks.find((track) => track.id === currentTrackId) || null;

  useEffect(() => {
    shouldPlayRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    shouldBePlayingRef.current = lastKnownShouldBePlaying;
  }, [lastKnownShouldBePlaying]);

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

  const syncFromAudioElement = useCallback(() => {
    const snapshot = {
      paused: audio.paused,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      hasSrc: Boolean(audio.src),
      readyState: audio.readyState,
      hasError: Boolean(audio.error)
    };

    reconcilePlaybackFromStore(snapshot);

    if (!snapshot.hasSrc || snapshot.readyState === 0 || snapshot.hasError) {
      setIsPlaying(false);
    }

    return snapshot;
  }, [audio, reconcilePlaybackFromStore, setIsPlaying]);

  const seek = useCallback(
    (value: number) => {
      audio.currentTime = clamp(value, 0, audio.duration || 0);
      lastSyncedTimeRef.current = audio.currentTime;
      setCurrentTime(audio.currentTime);
      syncFromAudioElement();
    },
    [audio, setCurrentTime, syncFromAudioElement]
  );

  const playNext = useCallback(async () => {
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
  }, [currentTrackId, orderedTrackIds, repeat, setCurrent]);

  const playPrev = useCallback(() => {
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
  }, [currentTrackId, orderedTrackIds, repeat, setCurrent]);

  const play = useCallback(async () => {
    setLastKnownShouldBePlaying(true);
    setPlaybackNotice(null);

    const started = await safePlay(audio);
    const snapshot = syncFromAudioElement();

    if (!started || snapshot.paused) {
      setLastKnownShouldBePlaying(false);
      setIsPlaying(false);
      setPlaybackNotice("Playback paused by iOS. Tap Play to continue.");
      await releaseWakeLock().catch(() => {
        // Ignore wake lock release issues.
      });
      return;
    }

    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    await requestWakeLock().catch(() => {
      // Ignore wake lock failures.
    });
  }, [audio, setLastKnownShouldBePlaying, setPlaybackNotice, syncFromAudioElement, setIsPlaying]);

  const pause = useCallback(async () => {
    setLastKnownShouldBePlaying(false);
    safePause(audio);
    syncFromAudioElement();
    setIsPlaying(false);
    setPlaybackNotice(null);

    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    await releaseWakeLock().catch(() => {
      // Ignore wake lock release issues.
    });
  }, [audio, setLastKnownShouldBePlaying, syncFromAudioElement, setIsPlaying, setPlaybackNotice]);

  const registerMediaSessionHandlers = useCallback(() => {
    setMediaSessionHandlers({
      onPlay: () => {
        void play();
      },
      onPause: () => {
        void pause();
      },
      onNext: () => {
        void playNext();
      },
      onPrev: playPrev,
      onSeek: seek
    });
  }, [pause, play, playNext, playPrev, seek]);

  useEffect(() => {
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    registerMediaSessionHandlers();
  }, [registerMediaSessionHandlers]);

  const reconcilePlaybackState = useCallback(
    async (_reason: string) => {
      const snapshot = syncFromAudioElement();

      if (currentTrack) {
        setupMediaSession(currentTrack);
      }
      registerMediaSessionHandlers();

      const shouldTryResume =
        !document.hidden &&
        lastKnownShouldBePlaying &&
        snapshot.hasSrc &&
        snapshot.paused &&
        !snapshot.hasError &&
        !audio.ended;

      if (shouldTryResume) {
        const resumed = await safePlay(audio);
        const afterResume = syncFromAudioElement();

        if (resumed && !afterResume.paused) {
          setPlaybackNotice(null);
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          await requestWakeLock().catch(() => {
            // Ignore wake lock failures.
          });
        } else {
          setLastKnownShouldBePlaying(false);
          setIsPlaying(false);
          setPlaybackNotice("Playback was paused by iOS. Tap Play to continue.");
        }
      }

      if (!snapshot.hasSrc || snapshot.readyState === 0 || snapshot.hasError) {
        setIsPlaying(false);
      }
    },
    [
      audio,
      currentTrack,
      lastKnownShouldBePlaying,
      registerMediaSessionHandlers,
      setIsPlaying,
      setLastKnownShouldBePlaying,
      setPlaybackNotice,
      syncFromAudioElement
    ]
  );

  const bindAudioListeners = useCallback(() => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => {
      setDuration(audio.duration || 0);
      syncFromAudioElement();
    };
    const onPlayEvent = () => {
      setLastKnownShouldBePlaying(true);
      setPlaybackNotice(null);
      syncFromAudioElement();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    };
    const onPauseEvent = () => {
      syncFromAudioElement();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    };
    const onError = () => {
      setLastKnownShouldBePlaying(false);
      setIsPlaying(false);
      setPlaybackNotice("Playback interrupted. Tap Play to try again.");
      syncFromAudioElement();
    };
    const onEnded = () => {
      if (repeat === "one") {
        seek(0);
        void play();
        return;
      }
      setLastKnownShouldBePlaying(false);
      void playNext();
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("play", onPlayEvent);
    audio.addEventListener("pause", onPauseEvent);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("play", onPlayEvent);
      audio.removeEventListener("pause", onPauseEvent);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [
    audio,
    play,
    playNext,
    repeat,
    seek,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setLastKnownShouldBePlaying,
    setPlaybackNotice,
    syncFromAudioElement
  ]);

  useEffect(() => {
    let detach = bindAudioListeners();

    rebindAudioListenersRef.current = () => {
      detach();
      detach = bindAudioListeners();
    };

    return () => {
      detach();
      rebindAudioListenersRef.current = null;
    };
  }, [bindAudioListeners]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        rebindAudioListenersRef.current?.();
      }
      void reconcilePlaybackState("visibilitychange");
    };

    const onPageHide = () => {
      void reconcilePlaybackState("pagehide");
    };

    const onPageShow = () => {
      rebindAudioListenersRef.current?.();
      void reconcilePlaybackState("pageshow");
    };

    const onFocus = () => {
      rebindAudioListenersRef.current?.();
      void reconcilePlaybackState("focus");
    };

    const onBlur = () => {
      void reconcilePlaybackState("blur");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [reconcilePlaybackState]);

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

      if (!src) {
        setIsPlaying(false);
        setLastKnownShouldBePlaying(false);
        setPlaybackNotice("Unable to load this track. Try selecting it again.");
        syncFromAudioElement();
        return;
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = src;

      audio.src = src;
      lastSyncedTimeRef.current = 0;
      setCurrentTime(0);
      setDuration(0);
      setupMediaSession(currentTrack);
      registerMediaSessionHandlers();
      syncFromAudioElement();

      if (shouldPlayRef.current || shouldBePlayingRef.current) {
        await play();
      }
    };

    void load();

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [
    audio,
    currentTrack,
    currentTrackId,
    play,
    registerMediaSessionHandlers,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setLastKnownShouldBePlaying,
    setPlaybackNotice,
    syncFromAudioElement
  ]);

  useEffect(() => {
    if (!currentTrackId) return;

    if (isPlaying) {
      if (!audio.paused) {
        syncFromAudioElement();
        return;
      }
      void play();
      return;
    }

    if (audio.paused) {
      syncFromAudioElement();
      return;
    }

    void pause();
  }, [audio, currentTrackId, isPlaying, pause, play, syncFromAudioElement]);

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
