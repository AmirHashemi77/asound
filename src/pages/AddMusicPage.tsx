import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  getRememberedFolderName,
  getSourceRootName,
  normalizePickedFiles,
  pickAudioDirectory,
  rememberFolderName,
  supportsDirectoryAccess,
  supportsWebkitDirectoryInput
} from "../lib/fileAccess";
import { type ImportMode, usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";

const directoryInputAttrs = {
  webkitdirectory: "",
  directory: ""
} as Record<string, string>;

type PickerIntent = "folder" | "files" | "update-folder" | "update-files";

const AddMusicPage = () => {
  const [status, setStatus] = useState<string | null>(null);
  const [pickerIntent, setPickerIntent] = useState<PickerIntent | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const importFilesChunked = usePlayerStore((s) => s.importFilesChunked);
  const rescanLibrary = usePlayerStore((s) => s.rescanLibrary);
  const lastImportMode = usePlayerStore((s) => s.lastImportMode);
  const importStatus = usePlayerStore((s) => s.importStatus);
  const importProgress = usePlayerStore((s) => s.importProgress);
  const importLastMessage = usePlayerStore((s) => s.importLastMessage);
  const importFailures = usePlayerStore((s) => s.importFailures);
  const resetImportState = usePlayerStore((s) => s.resetImportState);
  const { autoImport } = useSettings();

  const canUseDirectoryPicker = useMemo(() => supportsDirectoryAccess(), []);
  const canUseWebkitDirectory = useMemo(() => supportsWebkitDirectoryInput(), []);

  const isImportRunning = importStatus === "running";
  const isBusy = isImportRunning || isPicking;

  const helperText = useMemo(() => {
    if (canUseDirectoryPicker) {
      return "Import Folder uses persistent directory access when possible. Update Library reuses the last folder if permission is still granted.";
    }
    if (canUseWebkitDirectory) {
      return "On iPhone/iPad Safari, choose a folder from Files. Update Library will ask you to choose the folder again.";
    }
    return "If folder picking is unavailable, use Select Files and Update Library to import new tracks.";
  }, [canUseDirectoryPicker, canUseWebkitDirectory]);

  const buildStatus = (result: {
    imported: number;
    skipped: number;
    failed: number;
    warning?: string;
    canceled?: boolean;
  }) => {
    if (result.canceled) return "Operation canceled.";

    let message = result.imported > 0 ? `Added ${result.imported} tracks.` : "No new tracks found.";
    message = `${message} Failed: ${result.failed}.`;
    if (result.skipped > 0) {
      message = `${message} Skipped duplicates: ${result.skipped}.`;
    }
    if (result.warning) {
      message = `${message} ${result.warning}`;
    }
    return message;
  };

  const importWithMode = async (files: File[], mode: ImportMode, warning?: string) => {
    if (!files.length) {
      setStatus("No files selected.");
      return;
    }

    setStatus(null);
    resetImportState();

    try {
      const result = await importFilesChunked(files, {
        mode,
        autoImport
      });
      setStatus(
        buildStatus({
          ...result,
          warning: warning || result.warning
        })
      );
    } catch {
      setStatus("Import failed due to an unrecoverable error. Please try again.");
    } finally {
      setPickerIntent(null);
      setIsPicking(false);
    }
  };

  const importFolderWithDirectoryPicker = async (mode: ImportMode) => {
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
        mode,
        autoImport
      });
      setStatus(buildStatus(result));
    } catch {
      setStatus("Folder selection was canceled or denied.");
    } finally {
      setPickerIntent(null);
      setIsPicking(false);
    }
  };

  const onFolderInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizePickedFiles(event.target.files);
    event.target.value = "";

    let warning: string | undefined;
    if ((pickerIntent === "update-folder" || pickerIntent === "folder") && files.length > 0) {
      const roots = new Set(
        files
          .map((file) => getSourceRootName((file as File & { webkitRelativePath?: string }).webkitRelativePath))
          .filter(Boolean)
      );
      if (roots.size === 1) {
        const selectedRoot = Array.from(roots)[0] as string;
        const previousRoot = getRememberedFolderName();
        rememberFolderName(selectedRoot);
        if (pickerIntent === "update-folder" && previousRoot && previousRoot !== selectedRoot) {
          warning = `You selected a different folder (${selectedRoot}) than before (${previousRoot}).`;
        }
      }
    }

    const mode: ImportMode = pickerIntent === "update-folder" ? "update" : "folder";
    setIsPicking(true);
    await importWithMode(files, mode, warning);
  };

  const onFilesInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizePickedFiles(event.target.files);
    event.target.value = "";

    const mode: ImportMode = pickerIntent === "update-files" ? "update" : "files";
    setIsPicking(true);
    await importWithMode(files, mode);
  };

  const onImportFolderClick = async () => {
    if (canUseDirectoryPicker) {
      await importFolderWithDirectoryPicker("folder");
      return;
    }

    setPickerIntent("folder");
    folderInputRef.current?.click();
  };

  const onSelectFilesClick = () => {
    setPickerIntent("files");
    filesInputRef.current?.click();
  };

  const onUpdateLibraryClick = async () => {
    if (lastImportMode === "folder") {
      if (canUseDirectoryPicker) {
        setStatus(null);
        setIsPicking(true);
        resetImportState();
        try {
          const result = await rescanLibrary({
            autoImport
          });
          setStatus(buildStatus(result));
        } catch {
          setStatus("Update failed due to an unrecoverable error. Please try again.");
        } finally {
          setIsPicking(false);
        }
        return;
      }

      setPickerIntent("update-folder");
      folderInputRef.current?.click();
      return;
    }

    if (lastImportMode === "files") {
      setPickerIntent("update-files");
      filesInputRef.current?.click();
      return;
    }

    if (canUseWebkitDirectory) {
      setPickerIntent("update-folder");
      folderInputRef.current?.click();
      return;
    }

    setPickerIntent("update-files");
    filesInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-primary">Add Music</h1>
        <p className="text-sm text-muted">{helperText}</p>
      </header>

      <div className="glass space-y-4 rounded-2xl p-5 shadow-soft">
        {canUseWebkitDirectory && !canUseDirectoryPicker && (
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted">
            iPhone/iPad: tap Import Folder and choose your music folder from the Files app.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onImportFolderClick}
            disabled={isBusy}
            className="rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
          >
            Import Folder
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onSelectFilesClick}
            disabled={isBusy}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Select Files
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onUpdateLibraryClick}
            disabled={isBusy}
            className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 disabled:opacity-50"
          >
            Update Library
          </motion.button>
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
      </div>

      {isImportRunning && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          {`Importing ${importProgress.processed}/${importProgress.total} · Succeeded ${importProgress.succeeded} · Failed ${importProgress.failed}`}
        </p>
      )}

      {!isImportRunning && importLastMessage && <p className="text-sm text-muted">{importLastMessage}</p>}

      {importFailures.length > 0 && (
        <p className="text-xs text-muted">
          First failure: {importFailures[0].fileName} ({importFailures[0].reason})
        </p>
      )}

      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
};

export default AddMusicPage;
