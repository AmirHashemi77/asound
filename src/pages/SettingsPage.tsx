import { useState } from "react";
import { useTheme } from "../store/theme";
import { useSettings } from "../store/settings";
import { trackRepo } from "../db/trackRepo";
import { handleRepo } from "../db/handleRepo";
import { LIBRARY_LAST_FOLDER_NAME_KEY } from "../lib/fileAccess";
import { usePlayerStore } from "../store/player";

const SettingsPage = () => {
  const { mode, setMode } = useTheme();
  const { lowPowerMode, autoImport, setLowPowerMode, setAutoImport } = useSettings();
  const [status, setStatus] = useState<string | null>(null);
  const setTracks = usePlayerStore((s) => s.setTracks);

  const clearLibrary = async () => {
    await trackRepo.clear();
    await handleRepo.clear();
    localStorage.removeItem(LIBRARY_LAST_FOLDER_NAME_KEY);
    setTracks([]);
    setStatus("Library and cached audio cleared.");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-primary">Settings</h1>
        <p className="text-sm text-muted">Tune your PWA experience.</p>
      </header>

      <div className="glass space-y-4 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-primary">Theme</p>
            <p className="text-xs text-muted">Follow system or force a theme.</p>
          </div>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as "light" | "dark" | "system")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-primary">Low Power Mode</p>
            <p className="text-xs text-muted">Disable Three.js visuals to save battery.</p>
          </div>
          <input
            type="checkbox"
            checked={lowPowerMode}
            onChange={(event) => setLowPowerMode(event.target.checked)}
            className="h-5 w-5"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-primary">Auto Import</p>
            <p className="text-xs text-muted">
              Store selected files in IndexedDB for offline playback.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoImport}
            onChange={(event) => setAutoImport(event.target.checked)}
            className="h-5 w-5"
          />
        </div>
      </div>

      <div className="glass space-y-3 rounded-2xl p-5 text-sm text-muted">
        <p className="font-semibold text-primary">iOS PWA Limitations</p>
        <ul className="list-disc space-y-2 pl-4">
          <li>File System Access API is not available; use the file picker.</li>
          <li>Background audio and lock screen controls are limited by Safari.</li>
          <li>IndexedDB storage for large files may be capped per device.</li>
        </ul>
      </div>

      <div className="glass space-y-3 rounded-2xl p-5">
        <p className="font-semibold text-primary">Storage</p>
        <p className="text-sm text-muted">Clear cached audio and library data.</p>
        <button
          onClick={clearLibrary}
          className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
        >
          Clear Library & Cache
        </button>
        {status && <p className="text-xs text-muted">{status}</p>}
      </div>
    </div>
  );
};

export default SettingsPage;
