import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HiMiniBackward, HiMiniForward, HiMiniPause, HiMiniPlay } from "react-icons/hi2";
import { useAudio } from "../store/audioContext";
import { usePlayerStore } from "../store/player";
import { formatTime } from "../lib/format";

const DEFAULT_COVER = "/default-cover.png";

const MiniPlayer = () => {
  const { currentTrack, play, pause, playNext, playPrev } = useAudio();
  const { isPlaying, currentTime, duration, playbackNotice } = usePlayerStore();

  if (!currentTrack) return null;

  return (
    <div className="glass mx-3 mb-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 shadow-soft sm:mx-4 sm:gap-3 sm:px-4 sm:py-3">
      <Link to="/player" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base sm:h-12 sm:w-12 sm:text-lg">
          <img
            src={currentTrack.coverUrl || DEFAULT_COVER}
            alt={currentTrack.title}
            className="h-full w-full rounded-xl object-cover"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_COVER;
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary sm:text-base">{currentTrack.title}</p>
          <p className="truncate text-xs text-muted">
            {currentTrack.artist || "Unknown Artist"}
            <span className="hidden min-[380px]:inline">
              {" "}
              · {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </p>
          {playbackNotice && <p className="truncate text-[10px] text-muted/90">{playbackNotice}</p>}
        </div>
      </Link>
      <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={playPrev}
          aria-label="Previous track"
          className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-primary min-[360px]:flex sm:h-9 sm:w-9"
        >
          <HiMiniBackward className="text-base sm:text-lg" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-glow text-white shadow-glow sm:h-10 sm:w-10"
        >
          {isPlaying ? <HiMiniPause className="text-lg sm:text-xl" /> : <HiMiniPlay className="text-lg sm:text-xl" />}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={playNext}
          aria-label="Next track"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-primary sm:h-9 sm:w-9"
        >
          <HiMiniForward className="text-base sm:text-lg" />
        </motion.button>
      </div>
    </div>
  );
};

export default MiniPlayer;
