import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  HiOutlineArrowUpTray,
  HiOutlineFolderOpen,
  HiOutlineMusicalNote,
  HiOutlineXMark
} from "react-icons/hi2";
import { trackRepo } from "../db/trackRepo";
import {
  pickAudioDirectory,
  supportsDirectoryAccess,
  supportsWebkitDirectoryInput
} from "../lib/fileAccess";
import { usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";

const FIRST_IMPORT_KEY = "library-first-import-complete";
const directoryInputAttrs = {
  webkitdirectory: "",
  directory: ""
} as Record<string, string>;

const InitialImportGate = () => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  const importFiles = usePlayerStore((s) => s.importFiles);
  const autoImport = useSettings((s) => s.autoImport);

  const canUseDirectoryPicker = useMemo(() => supportsDirectoryAccess(), []);
  const canUseWebkitDirectory = useMemo(() => supportsWebkitDirectoryInput(), []);

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

  const runImport = async (files: File[]) => {
    if (!files.length) {
      setStatus("No audio files found.");
      return;
    }

    setLoading(true);
    setStatus(null);
    setProgressText("Preparing import...");

    try {
      const result = await importFiles(files, {
        autoImport,
        onProgress: (progress) => {
          if (progress.total === 0) {
            setProgressText("Preparing import...");
            return;
          }
          setProgressText(`Importing ${Math.min(progress.current, progress.total)}/${progress.total}`);
        }
      });

      if (result.imported > 0 || result.skipped > 0) {
        localStorage.setItem(FIRST_IMPORT_KEY, "done");
        setOpen(false);
      } else if (result.failed > 0) {
        setStatus("Import failed. Please try another folder or files.");
      }
    } catch {
      setStatus("Import failed. Please try again.");
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  const importFromDirectory = async () => {
    try {
      const picked = await pickAudioDirectory();
      if (!picked.files.length) {
        setStatus("No audio files found in the selected folder.");
        return;
      }

      setLoading(true);
      setStatus(null);
      setProgressText("Preparing import...");

      const result = await importFiles([], {
        autoImport,
        candidates: picked.files,
        onProgress: (progress) => {
          if (progress.total === 0) {
            setProgressText("Preparing import...");
            return;
          }
          setProgressText(`Importing ${Math.min(progress.current, progress.total)}/${progress.total}`);
        }
      });

      if (result.imported > 0 || result.skipped > 0) {
        localStorage.setItem(FIRST_IMPORT_KEY, "done");
        setOpen(false);
      }
    } catch {
      setStatus("Permission was denied or folder selection was canceled.");
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  const onFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await runImport(files);
    event.target.value = "";
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
                    First-time setup: choose your music folder or files to populate the library.
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
                  {loading ? "Importing..." : "Allow Folder Access & Import"}
                </button>
              ) : canUseWebkitDirectory ? (
                <label
                  className={`relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow ${
                    loading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <HiOutlineFolderOpen className="text-lg" />
                  {loading ? "Importing..." : "Choose Folder (Files app)"}
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    {...directoryInputAttrs}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={onFileInput}
                    disabled={loading}
                  />
                </label>
              ) : (
                <label
                  className={`relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow ${
                    loading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <HiOutlineArrowUpTray className="text-lg" />
                  {loading ? "Importing..." : "Choose Audio Files"}
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={onFileInput}
                    disabled={loading}
                  />
                </label>
              )}

              {canUseDirectoryPicker && (
                <label
                  className={`relative block w-full cursor-pointer rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-medium text-primary ${
                    loading ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  Choose Files Instead
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={onFileInput}
                    disabled={loading}
                  />
                </label>
              )}

              {canUseWebkitDirectory && !canUseDirectoryPicker && (
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted">
                  iPhone/iPad: select the folder again from Files when you update the library later.
                </p>
              )}

              {progressText && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  {progressText}
                </p>
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
