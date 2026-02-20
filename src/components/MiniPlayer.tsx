import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HiMiniBackward, HiMiniForward, HiMiniPause, HiMiniPlay } from "react-icons/hi2";
import { useAudio } from "../store/audioContext";
import { usePlayerStore } from "../store/player";
import { formatTime } from "../lib/format";

const MiniPlayer = () => {
  const { currentTrack, play, pause, playNext, playPrev } = useAudio();
  const { isPlaying, currentTime, duration } = usePlayerStore();

  if (!currentTrack) return null;

  return (
    <div className="glass mx-4 mb-3 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft">
      <Link to="/player" className="flex flex-1 items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-lg">
          {currentTrack.coverUrl ? (
            <img src={currentTrack.coverUrl} alt={currentTrack.title} className="h-12 w-12 rounded-xl" />
          ) : (
            "♪"
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-primary">{currentTrack.title}</p>
          <p className="truncate text-xs text-muted">
            {currentTrack.artist || "Unknown Artist"} · {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={playPrev}
          aria-label="Previous track"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-primary"
        >
          <HiMiniBackward className="text-lg" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-glow text-white shadow-glow"
        >
          {isPlaying ? <HiMiniPause className="text-xl" /> : <HiMiniPlay className="text-xl" />}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={playNext}
          aria-label="Next track"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-primary"
        >
          <HiMiniForward className="text-lg" />
        </motion.button>
      </div>
    </div>
  );
};

export default MiniPlayer;
