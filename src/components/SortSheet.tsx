import { AnimatePresence, motion } from "framer-motion";

interface SortSheetProps {
  open: boolean;
  selected: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

const SortSheet = ({ open, options, selected, onSelect, onClose }: SortSheetProps) => (
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
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="safe-bottom glass w-full rounded-t-3xl px-6 pb-6 pt-4"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
          <h3 className="mb-3 font-display text-lg font-semibold text-primary">Sort & Filter</h3>
          <div className="space-y-2">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                  selected === option.value ? "bg-white/10 text-primary" : "text-muted"
                }`}
              >
                {option.label}
                {selected === option.value && <span>✓</span>}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default SortSheet;
