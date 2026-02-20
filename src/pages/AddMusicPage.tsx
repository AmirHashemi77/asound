import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { extractTrackMeta, pickAudioFiles, supportsFileSystemAccess } from "../lib/fileAccess";
import { trackRepo } from "../db/trackRepo";
import { usePlayerStore } from "../store/player";
import { useSettings } from "../store/settings";

const AddMusicPage = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const addTracks = usePlayerStore((s) => s.addTracks);
  const { autoImport } = useSettings();

  const helperText = useMemo(() => {
    if (supportsFileSystemAccess()) {
      return "You can pick folders/files. We will remember handles when supported.";
    }
    return "On iOS Safari, we use file picker. For offline playback, import to library.";
  }, []);

  const handleFiles = async (files: File[], handles?: FileSystemFileHandle[]) => {
    if (!files.length) return;
    setLoading(true);
    setStatus("Reading audio metadata...");

    const tracks = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const handle = handles?.[i];
      const meta = await extractTrackMeta(file, handle);
      if (autoImport || !handle) {
        meta.source = "blob";
        meta.blob = file;
      }
      tracks.push(meta);
    }

    await trackRepo.upsertAll(tracks);
    addTracks(tracks);
    setStatus(`Added ${tracks.length} tracks to your library.`);
    setLoading(false);
  };

  const pickWithFS = async () => {
    try {
      const { files, handles } = await pickAudioFiles();
      await handleFiles(files, handles);
    } catch {
      setStatus("Failed to pick files. Please try again.");
    }
  };

  const pickWithInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await handleFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-primary">Add Music</h1>
        <p className="text-sm text-muted">{helperText}</p>
      </header>

      <div className="glass space-y-4 rounded-2xl p-5 shadow-soft">
        <p className="text-sm text-muted">
          Tip: Importing to library stores audio blobs in IndexedDB for offline play, but iOS
          Safari limits storage. Use Settings to clear cached audio.
        </p>
        <div className="flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={pickWithFS}
            disabled={!supportsFileSystemAccess() || loading}
            className="rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
          >
            {supportsFileSystemAccess() ? "Pick Audio Files" : "File Picker Not Supported"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold"
          >
            Upload via File Picker (iOS / Safari)
          </motion.button>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="audio/*"
            multiple
            onChange={pickWithInput}
          />
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Processing files...</p>}
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
};

export default AddMusicPage;
