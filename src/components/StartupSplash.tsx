import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const StartupSplash = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_80%_90%,rgba(124,58,237,0.2),transparent_44%),#0b0f1a]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <img
              src="/icons/asound-brand.svg"
              alt="ASound logo"
              className="h-24 w-24 rounded-3xl object-contain shadow-soft"
            />
            <div className="text-center">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white">ASound</h1>
              <p className="mt-1 text-sm text-slate-300">Hear With Us</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartupSplash;
