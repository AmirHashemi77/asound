import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  HiOutlineFolderOpen,
  HiOutlineMusicalNote,
  HiOutlineXMark
} from "react-icons/hi2";
import { trackRepo } from "../db/trackRepo";
import {
  normalizePickedFiles,
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
  const [status, setStatus] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const importFilesChunked = usePlayerStore((s) => s.importFilesChunked);
  const importStatus = usePlayerStore((s) => s.importStatus);
  const importProgress = usePlayerStore((s) => s.importProgress);
  const importFailures = usePlayerStore((s) => s.importFailures);
  const resetImportState = usePlayerStore((s) => s.resetImportState);

  const autoImport = useSettings((s) => s.autoImport);
  const canUseDirectoryPicker = useMemo(() => supportsDirectoryAccess(), []);
  const canUseWebkitDirectory = useMemo(() => supportsWebkitDirectoryInput(), []);

  const isImportRunning = importStatus === "running";
  const isBusy = isImportRunning || isPicking;

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

  const handleImportResult = (result: { imported: number; skipped: number; failed: number }) => {
    if (result.imported > 0 || result.skipped > 0) {
      localStorage.setItem(FIRST_IMPORT_KEY, "done");
      setOpen(false);
      return;
    }

    if (result.failed > 0) {
      setStatus(`Import completed with ${result.failed} failures.`);
      return;
    }

    setStatus("No audio files found.");
  };

  const importFromFiles = async (files: File[], mode: "folder" | "files") => {
    if (!files.length) {
      setStatus("No files selected.");
      return;
    }

    setStatus(null);
    setIsPicking(true);
    resetImportState();

    try {
      const result = await importFilesChunked(files, {
        mode,
        autoImport
      });
      handleImportResult(result);
    } catch {
      setStatus("Import failed due to an unrecoverable error. Please try again.");
    } finally {
      setIsPicking(false);
    }
  };

  const onImportFolder = async () => {
    if (canUseDirectoryPicker) {
      setStatus(null);
      setIsPicking(true);
      resetImportState();

      try {
        const picked = await pickAudioDirectory();
        if (!picked.files.length) {
          setStatus("No audio files found in selected folder.");
          return;
        }

        const result = await importFilesChunked([], {
          candidates: picked.files,
          mode: "folder",
          autoImport
        });
        handleImportResult(result);
      } catch {
        setStatus("Folder selection was canceled or denied.");
      } finally {
        setIsPicking(false);
      }
      return;
    }

    if (canUseWebkitDirectory) {
      folderInputRef.current?.click();
      return;
    }

    setStatus("Folder import is not supported. Use Select Files.");
  };

  const onSelectFiles = () => {
    filesInputRef.current?.click();
  };

  const onFolderInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizePickedFiles(event.target.files);
    event.target.value = "";
    await importFromFiles(files, "folder");
  };

  const onFilesInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizePickedFiles(event.target.files);
    event.target.value = "";
    await importFromFiles(files, "files");
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
                  <p className="text-sm text-muted">Choose a folder or files to build your library.</p>
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
              <button
                onClick={onImportFolder}
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
              >
                <HiOutlineFolderOpen className="text-lg" />
                Import Folder
              </button>

              <button
                onClick={onSelectFiles}
                disabled={isBusy}
                className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-primary disabled:opacity-60"
              >
                Select Files
              </button>

              {canUseWebkitDirectory && !canUseDirectoryPicker && (
                <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted">
                  iPhone/iPad: choose your folder from Files when prompted.
                </p>
              )}

              {isImportRunning && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  {`Importing ${importProgress.processed}/${importProgress.total} · Succeeded ${importProgress.succeeded} · Failed ${importProgress.failed}`}
                </p>
              )}

              {importFailures.length > 0 && (
                <p className="text-xs text-muted">
                  First failure: {importFailures[0].fileName} ({importFailures[0].reason})
                </p>
              )}

              {status && <p className="text-xs text-muted">{status}</p>}
            </div>

            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...directoryInputAttrs}
              className="hidden"
              onChange={onFolderInput}
              disabled={isBusy}
            />
            <input
              ref={filesInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFilesInput}
              disabled={isBusy}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InitialImportGate;
