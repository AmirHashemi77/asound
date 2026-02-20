import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AudioProvider } from "./store/audioContext";
import { usePlayerStore } from "./store/player";
import { useSettings } from "./store/settings";
import BottomNav from "./components/BottomNav";
import MiniPlayer from "./components/MiniPlayer";
import BackgroundVisualizer from "./components/BackgroundVisualizer";
import InitialImportGate from "./components/InitialImportGate";
import StartupSplash from "./components/StartupSplash";
import LibraryPage from "./pages/LibraryPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlayerPage from "./pages/PlayerPage";
import SettingsPage from "./pages/SettingsPage";
import AddMusicPage from "./pages/AddMusicPage";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
};

const App = () => {
  const location = useLocation();
  const loadLibrary = usePlayerStore((s) => s.loadLibrary);
  const loadPlaylists = usePlayerStore((s) => s.loadPlaylists);
  const lowPowerMode = useSettings((s) => s.lowPowerMode);

  useEffect(() => {
    loadLibrary();
    loadPlaylists();
  }, [loadLibrary, loadPlaylists]);

  return (
    <AudioProvider>
      <div className="relative min-h-screen bg-[color:var(--app-bg)] text-primary">
        <StartupSplash />
        <InitialImportGate />
        <PwaInstallPrompt />
        {!lowPowerMode && <BackgroundVisualizer />}
        <div className="relative z-10 flex min-h-screen flex-col">
          <main className="flex-1 px-4 pb-24 pt-6">
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/"
                  element={
                    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <LibraryPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/playlists"
                  element={
                    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <PlaylistsPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/player"
                  element={
                    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <PlayerPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <SettingsPage />
                    </motion.div>
                  }
                />
                <Route
                  path="/add"
                  element={
                    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                      <AddMusicPage />
                    </motion.div>
                  }
                />
              </Routes>
            </AnimatePresence>
          </main>
          <MiniPlayer />
          <BottomNav />
        </div>
      </div>
    </AudioProvider>
  );
};

export default App;
