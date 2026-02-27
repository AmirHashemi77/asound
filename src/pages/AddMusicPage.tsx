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
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [pickerIntent, setPickerIntent] = useState<PickerIntent | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const importPickedFiles = usePlayerStore((s) => s.importPickedFiles);
  const rescanLibrary = usePlayerStore((s) => s.rescanLibrary);
  const lastImportMode = usePlayerStore((s) => s.lastImportMode);
  const { autoImport } = useSettings();

  const canUseDirectoryPicker = useMemo(() => supportsDirectoryAccess(), []);
  const canUseWebkitDirectory = useMemo(() => supportsWebkitDirectoryInput(), []);

  const helperText = useMemo(() => {
    if (canUseDirectoryPicker) {
      return "Import Folder uses persistent directory access when possible. Update Library reuses the last folder if permission is still granted.";
    }
    if (canUseWebkitDirectory) {
      return "On iPhone/iPad Safari, choose a folder from Files. Update Library will ask you to choose the folder again.";
    }
    return "If folder picking is unavailable, use Select Files and Update Library to import new tracks.";
  }, [canUseDirectoryPicker, canUseWebkitDirectory]);

  const onProgress = (current: number, total: number) => {
    if (!total) {
      setProgressText("Preparing import...");
      return;
    }
    setProgressText(`Importing ${Math.min(current, total)} / ${total}`);
  };

  const buildStatus = (result: {
    imported: number;
    skipped: number;
    failed: number;
    warning?: string;
    canceled?: boolean;
  }) => {
    if (result.canceled) return "Operation canceled.";

    let message = "No new tracks found.";
    if (result.imported > 0) {
      message = `Added ${result.imported} new tracks.`;
    }
    if (result.failed > 0) {
      message = `${message} ${result.failed} files failed.`;
    }
    if (result.warning) {
      message = `${message} ${result.warning}`;
    }
    if (result.imported === 0 && result.skipped > 0) {
      message = `${message} (${result.skipped} duplicate files skipped)`;
    }
    return message;
  };

  const importWithMode = async (files: File[], mode: ImportMode, warning?: string) => {
    if (!files.length) {
      setStatus("No files selected.");
      return;
    }

    setLoading(true);
    setStatus(null);
    setProgressText("Preparing import...");

    try {
      const result = await importPickedFiles(files, {
        mode,
        autoImport,
        onProgress: (progress) => onProgress(progress.current, progress.total)
      });
      setStatus(
        buildStatus({
          ...result,
          warning: warning || result.warning
        })
      );
    } catch {
      setStatus("Import failed. Please try again.");
    } finally {
      setLoading(false);
      setProgressText(null);
      setPickerIntent(null);
    }
  };

  const importFolderWithDirectoryPicker = async (mode: ImportMode) => {
    setLoading(true);
    setStatus(null);
    setProgressText("Preparing import...");

    try {
      const picked = await pickAudioDirectory();
      if (!picked.files.length) {
        setStatus("No audio files found in selected folder.");
        return;
      }

      const result = await importPickedFiles([], {
        candidates: picked.files,
        mode,
        autoImport,
        onProgress: (progress) => onProgress(progress.current, progress.total)
      });
      setStatus(buildStatus(result));
    } catch {
      setStatus("Folder selection was canceled or denied.");
    } finally {
      setLoading(false);
      setProgressText(null);
      setPickerIntent(null);
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
    await importWithMode(files, mode, warning);
  };

  const onFilesInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = normalizePickedFiles(event.target.files);
    event.target.value = "";
    const mode: ImportMode = pickerIntent === "update-files" ? "update" : "files";
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
        setLoading(true);
        setStatus(null);
        setProgressText("Preparing import...");

        try {
          const result = await rescanLibrary({
            autoImport,
            onProgress: (progress) => onProgress(progress.current, progress.total)
          });
          setStatus(buildStatus(result));
        } catch {
          setStatus("Update failed. Please try again.");
        } finally {
          setLoading(false);
          setProgressText(null);
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
            disabled={loading}
            className="rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
          >
            Import Folder
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onSelectFilesClick}
            disabled={loading}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Select Files
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onUpdateLibraryClick}
            disabled={loading}
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
          disabled={loading}
        />
        <input
          ref={filesInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFilesInput}
          disabled={loading}
        />
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
