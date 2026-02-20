import { motion, AnimatePresence } from "framer-motion";
import type { TrackMeta } from "../db/types";
import { formatTime } from "../lib/format";

interface TrackListProps {
  tracks: TrackMeta[];
  currentTrackId?: string | null;
  onSelect: (track: TrackMeta) => void;
}

const getDisplayMeta = (track: TrackMeta) => {
  const split = track.title.split(" - ");
  const hasFallbackPattern = !track.artist && split.length > 1;
  const title = hasFallbackPattern ? split.slice(1).join(" - ") : track.title;
  const artist = hasFallbackPattern ? split[0] : track.artist || "Unknown Artist";
  const duration = track.duration && track.duration > 0 ? formatTime(track.duration) : "--:--";
  return { title, artist, duration };
};

const TrackList = ({ tracks, currentTrackId, onSelect }: TrackListProps) => (
  <div className="space-y-3">
    <AnimatePresence>
      {tracks.map((track) => {
        const display = getDisplayMeta(track);
        return (
        <motion.button
          key={track.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          layout
          onClick={() => onSelect(track)}
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
            track.id === currentTrackId
              ? "bg-white/10 text-primary shadow-soft"
              : "bg-white/5 text-primary hover:bg-white/10"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-lg">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="h-12 w-12 rounded-xl" />
            ) : (
              "♪"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{display.title}</p>
            <p className="truncate text-xs text-muted">
              {display.artist} · {display.duration}
            </p>
          </div>
          <div className="text-xs text-muted">{track.album || ""}</div>
        </motion.button>
        );
      })}
    </AnimatePresence>
  </div>
);

export default TrackList;
