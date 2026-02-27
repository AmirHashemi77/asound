import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  type AudioImportCandidate,
  getRememberedFolderName,
  getSourceRootName,
  pickAudioDirectory,
  pickAudioFiles,
  rememberFolderName,
  supportsDirectoryAccess,
  supportsFileSystemAccess,
  supportsWebkitDirectoryInput
} from "../lib/fileAccess";
import { usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";

const directoryInputAttrs = {
  webkitdirectory: "",
  directory: ""
} as Record<string, string>;

const AddMusicPage = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);

  const updateInputRef = useRef<HTMLInputElement>(null);

  const importFiles = usePlayerStore((s) => s.importFiles);
  const rescanLibrary = usePlayerStore((s) => s.rescanLibrary);
  const { autoImport } = useSettings();

  const canUseFsPicker = useMemo(() => supportsFileSystemAccess(), []);
  const canUseDirectoryPicker = useMemo(() => supportsDirectoryAccess(), []);
  const canUseWebkitDirectory = useMemo(() => supportsWebkitDirectoryInput(), []);

  const helperText = useMemo(() => {
    if (canUseDirectoryPicker) {
      return "Folder access is supported. We can rescan your last selected folder without reselecting when permission is granted.";
    }
    if (canUseWebkitDirectory) {
      return "On iPhone/iPad Safari, choose a folder from Files. Update Library will ask you to pick that folder again.";
    }
    return "Folder selection is unavailable here. Use multi-file import.";
  }, [canUseDirectoryPicker, canUseWebkitDirectory]);

  const toSummary = (result: {
    imported: number;
    skipped: number;
    failed: number;
    warning?: string;
    canceled?: boolean;
  }) => {
    if (result.canceled) return "Import was canceled.";

    const base = `Imported ${result.imported}, skipped ${result.skipped} duplicates, failed ${result.failed}.`;
    return result.warning ? `${base} ${result.warning}` : base;
  };

  const onProgress = (current: number, total: number) => {
    if (!total) {
      setProgressText("Preparing import...");
      return;
    }
    setProgressText(`Importing ${Math.min(current, total)}/${total}`);
  };

  const importFromCandidates = async (candidates: AudioImportCandidate[], warning?: string) => {
    setLoading(true);
    setStatus(null);
    setProgressText("Preparing import...");

    try {
      const result = await importFiles([], {
        candidates,
        autoImport,
        onProgress: (progress) => onProgress(progress.current, progress.total)
      });

      setStatus(toSummary({
        ...result,
        warning: warning || result.warning
      }));
    } catch {
      setStatus("Import failed. Please try again.");
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  const importFromFiles = async (files: File[], warning?: string) => {
    if (!files.length) {
      setStatus("No audio files were selected.");
      return;
    }

    setLoading(true);
    setStatus(null);
    setProgressText("Preparing import...");

    try {
      const result = await importFiles(files, {
        autoImport,
        onProgress: (progress) => onProgress(progress.current, progress.total)
      });
      setStatus(toSummary({
        ...result,
        warning: warning || result.warning
      }));
    } catch {
      setStatus("Import failed. Please try again.");
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  const importFolderWithDirectoryPicker = async () => {
    try {
      const picked = await pickAudioDirectory();
      if (!picked.files.length) {
        setStatus("No audio files found in the selected folder.");
        return;
      }
      await importFromCandidates(picked.files);
    } catch {
      setStatus("Folder selection was canceled or denied.");
    }
  };

  const importFilesWithFsPicker = async () => {
    try {
      const candidates = await pickAudioFiles();
      await importFromCandidates(candidates);
    } catch {
      setStatus("File selection failed. Please try again.");
    }
  };

  const onStandardFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await importFromFiles(files);
    event.target.value = "";
  };

  const onFolderInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await importFromFiles(files);
    event.target.value = "";
  };

  const updateLibrary = async () => {
    if (canUseDirectoryPicker) {
      setLoading(true);
      setStatus(null);
      setProgressText("Preparing import...");
      try {
        const result = await rescanLibrary({
          autoImport,
          onProgress: (progress) => onProgress(progress.current, progress.total)
        });
        setStatus(toSummary(result));
      } catch {
        setStatus("Update failed. Please try again.");
      } finally {
        setLoading(false);
        setProgressText(null);
      }
      return;
    }

    updateInputRef.current?.click();
  };

  const onUpdateInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    let warning: string | undefined;

    if (canUseWebkitDirectory && files.length > 0) {
      const roots = new Set(files.map((file) => getSourceRootName((file as File & { webkitRelativePath?: string }).webkitRelativePath)).filter(Boolean));
      if (roots.size === 1) {
        const selectedRoot = Array.from(roots)[0] as string;
        const previousRoot = getRememberedFolderName();
        rememberFolderName(selectedRoot);
        if (previousRoot && previousRoot !== selectedRoot) {
          warning = `You selected a different folder (${selectedRoot}) than before (${previousRoot}).`;
        }
      }
    }

    await importFromFiles(files, warning);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-primary">Add Music</h1>
        <p className="text-sm text-muted">{helperText}</p>
      </header>

      <div className="glass space-y-4 rounded-2xl p-5 shadow-soft">
        <p className="text-sm text-muted">
          Tip: importing to library stores blobs in IndexedDB for offline playback.
        </p>

        {canUseWebkitDirectory && !canUseDirectoryPicker && (
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted">
            iPhone/iPad: tap folder import and pick your music folder from the Files app.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {canUseDirectoryPicker ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={importFolderWithDirectoryPicker}
              disabled={loading}
              className="rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
            >
              Import Folder
            </motion.button>
          ) : canUseWebkitDirectory ? (
            <motion.label
              whileTap={{ scale: 0.98 }}
              className={`relative cursor-pointer rounded-2xl bg-glow px-4 py-3 text-center text-sm font-semibold text-white shadow-glow ${
                loading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Import Folder (Files app)
              <input
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="file"
                accept="audio/*"
                multiple
                {...directoryInputAttrs}
                onChange={onFolderInput}
                disabled={loading}
              />
            </motion.label>
          ) : null}

          {canUseFsPicker && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={importFilesWithFsPicker}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Pick Audio Files
            </motion.button>
          )}

          <motion.label
            whileTap={{ scale: 0.98 }}
            className={`relative cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold ${
              loading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Import Multiple Files
            <input
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="file"
              accept="audio/*"
              multiple
              onChange={onStandardFileInput}
              disabled={loading}
            />
          </motion.label>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={updateLibrary}
            disabled={loading}
            className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 disabled:opacity-50"
          >
            Update Library
          </motion.button>

          <input
            ref={updateInputRef}
            className="hidden"
            type="file"
            accept="audio/*"
            multiple
            {...(canUseWebkitDirectory ? directoryInputAttrs : {})}
            onChange={onUpdateInput}
            disabled={loading}
          />
        </div>
      </div>

      {progressText && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          {progressText}
        </p>
      )}
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
};

export default AddMusicPage;
