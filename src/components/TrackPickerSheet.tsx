import { AnimatePresence, motion } from "framer-motion";
import type { TrackMeta } from "../db/types";

interface TrackPickerSheetProps {
  open: boolean;
  tracks: TrackMeta[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

const TrackPickerSheet = ({ open, tracks, selectedIds, onToggle, onClose }: TrackPickerSheetProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 120 }}
          animate={{ y: 0 }}
          exit={{ y: 120 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="safe-bottom glass w-full rounded-t-3xl px-6 pb-6 pt-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <h3 className="mb-3 font-display text-lg font-semibold text-primary">Add Tracks</h3>
          <div className="max-h-[45vh] space-y-2 overflow-auto">
            {tracks.map((track) => {
              const selected = selectedIds.includes(track.id);
              return (
                <button
                  key={track.id}
                  onClick={() => onToggle(track.id)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm ${
                  selected ? "bg-white/10 text-primary" : "text-muted"
                  }`}
                >
                  <span className="truncate">{track.title}</span>
                  <span>{selected ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default TrackPickerSheet;
