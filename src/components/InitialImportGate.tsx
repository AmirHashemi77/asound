import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  HiOutlineArrowUpTray,
  HiOutlineFolderOpen,
  HiOutlineMusicalNote,
  HiOutlineXMark
} from "react-icons/hi2";
import { trackRepo } from "../db/trackRepo";
import { extractTrackMeta, pickAudioDirectory, supportsDirectoryAccess } from "../lib/fileAccess";
import { usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";

const FIRST_IMPORT_KEY = "library-first-import-complete";

const InitialImportGate = () => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const addTracks = usePlayerStore((s) => s.addTracks);
  const autoImport = useSettings((s) => s.autoImport);
  const canUseDirectoryPicker = useMemo(() => supportsDirectoryAccess(), []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (localStorage.getItem(FIRST_IMPORT_KEY) === "done") {
        if (active) setReady(true);
        return;
      }

      const existingTracks = await trackRepo.getAll();
      if (!active) return;

      if (existingTracks.length > 0) {
        localStorage.setItem(FIRST_IMPORT_KEY, "done");
        setReady(true);
        return;
      }

      setOpen(true);
      setReady(true);
    };

    init();

    return () => {
      active = false;
    };
  }, []);

  const importFiles = async (files: File[], handles?: FileSystemFileHandle[]) => {
    if (!files.length) {
      setStatus("No audio files found.");
      return;
    }

    setLoading(true);
    setStatus(`Importing ${files.length} audio files...`);

    try {
      const tracks = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const handle = handles?.[i];
        const meta = await extractTrackMeta(file, handle);

        // First import should be resilient for offline/iOS; blob keeps file available.
        if (autoImport || !handle) {
          meta.source = "blob";
          meta.blob = file;
        }

        tracks.push(meta);
      }

      await trackRepo.upsertAll(tracks);
      addTracks(tracks);
      localStorage.setItem(FIRST_IMPORT_KEY, "done");
      setOpen(false);
    } catch {
      setStatus("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const importFromDirectory = async () => {
    try {
      const { files, handles } = await pickAudioDirectory();
      await importFiles(files, handles);
    } catch {
      setStatus("Permission was denied or directory selection was canceled.");
    }
  };

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await importFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!ready) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-black/45 p-4"
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
            className="safe-bottom glass w-full rounded-3xl p-5 shadow-soft"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-glow/25 text-white">
                  <HiOutlineMusicalNote className="text-2xl" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-primary">Import Your Music</h2>
                  <p className="text-sm text-muted">
                    First-time setup: grant access once, then we import your audio library.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-muted"
                aria-label="Close"
              >
                <HiOutlineXMark className="text-lg" />
              </button>
            </div>

            <div className="space-y-3">
              {canUseDirectoryPicker ? (
                <button
                  onClick={importFromDirectory}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
                >
                  <HiOutlineFolderOpen className="text-lg" />
                  {loading ? "Importing..." : "Allow Folder Access & Import All Audio"}
                </button>
              ) : (
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
                >
                  <HiOutlineArrowUpTray className="text-lg" />
                  {loading ? "Importing..." : "Choose Audio Files to Import"}
                </button>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={onFileInput}
              />

              {canUseDirectoryPicker && (
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-primary disabled:opacity-60"
                >
                  Choose Files Instead
                </button>
              )}

              {status && <p className="text-xs text-muted">{status}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InitialImportGate;
