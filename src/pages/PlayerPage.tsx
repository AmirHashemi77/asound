import { motion } from "framer-motion";
import {
  HiOutlineArrowPathRoundedSquare,
  HiOutlineArrowsRightLeft,
  HiOutlineBackward,
  HiOutlineForward,
  HiOutlinePauseCircle,
  HiOutlinePlayCircle,
  HiOutlineSpeakerWave
} from "react-icons/hi2";
import { useAudio } from "../store/audioContext";
import { usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";
import { formatTime } from "../lib/format";

const DEFAULT_COVER = "/default-cover.png";

const PlayerPage = () => {
  const { currentTrack, play, pause, playNext, playPrev, seek } = useAudio();
  const { isPlaying, currentTime, duration, shuffle, repeat, toggleShuffle, cycleRepeat } =
    usePlayerStore();
  const { volume, setVolume } = useSettings();

  if (!currentTrack) {
    return (
      <div className="glass rounded-3xl p-6 text-center text-sm text-muted">
        Pick a track from the Library to start playing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Now Playing</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-primary">{currentTrack.title}</h1>
        <p className="text-sm text-muted">{currentTrack.artist || "Unknown Artist"}</p>
      </header>

      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-6 shadow-soft">
        <div className="flex h-60 w-60 items-center justify-center rounded-3xl bg-white/10">
          <img
            src={currentTrack.coverUrl || DEFAULT_COVER}
            alt={currentTrack.title}
            className="h-60 w-60 rounded-3xl object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_COVER;
            }}
          />
        </div>
        <div className="w-full">
          <input
            className="range-thumb w-full"
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onInput={(event) => seek(Number((event.target as HTMLInputElement).value))}
            onChange={(event) => seek(Number(event.target.value))}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleShuffle}
            aria-label="Toggle shuffle"
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              shuffle ? "bg-white/20 text-primary" : "bg-white/5 text-muted"
            }`}
          >
            <HiOutlineArrowsRightLeft className="text-[18px]" />
          </button>
          <button
            onClick={playPrev}
            aria-label="Previous track"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-primary"
          >
            <HiOutlineBackward className="text-xl" />
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-glow text-white shadow-glow"
          >
            {isPlaying ? (
              <HiOutlinePauseCircle className="text-3xl" />
            ) : (
              <HiOutlinePlayCircle className="text-3xl" />
            )}
          </motion.button>
          <button
            onClick={playNext}
            aria-label="Next track"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-primary"
          >
            <HiOutlineForward className="text-xl" />
          </button>
          <button
            onClick={cycleRepeat}
            aria-label="Change repeat mode"
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              repeat !== "off" ? "bg-white/20 text-primary" : "bg-white/5 text-muted"
            }`}
          >
            <HiOutlineArrowPathRoundedSquare className="text-[18px]" />
          </button>
        </div>
        <p className="text-xs text-muted">
          Shuffle: {shuffle ? "On" : "Off"} · Repeat:{" "}
          {repeat === "one" ? "One" : repeat === "all" ? "All" : "Off"}
        </p>

        <div className="w-full">
          <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
            <HiOutlineSpeakerWave className="text-base tracking-normal" />
            Volume
          </p>
          <input
            className="range-thumb w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerPage;
