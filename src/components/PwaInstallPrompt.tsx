import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HiOutlineArrowDownTray, HiOutlineShare, HiOutlineXMark } from "react-icons/hi2";

const SESSION_KEY = "pwa-install-prompt-shown";
const INSTALLED_KEY = "pwa-installed";

const isStandaloneMode = () => {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
};

const isIOSDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(() => localStorage.getItem(INSTALLED_KEY) === "1");

  const isIOS = useMemo(() => isIOSDevice(), []);
  const inStandalone = useMemo(() => isStandaloneMode(), []);

  useEffect(() => {
    if (inStandalone || installed) return;

    const seenInSession = sessionStorage.getItem(SESSION_KEY) === "1";
    if (isIOS && !seenInSession) {
      setVisible(true);
      sessionStorage.setItem(SESSION_KEY, "1");
    }

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);

      if (!seenInSession) {
        setVisible(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.setItem(INSTALLED_KEY, "1");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [inStandalone, installed, isIOS]);

  const requestInstall = async () => {
    if (!deferredPrompt) return;

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        setInstalled(true);
        localStorage.setItem(INSTALLED_KEY, "1");
      }
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  const canPromptInstall = Boolean(deferredPrompt);
  const showIOSHelp = isIOS && !canPromptInstall;

  if (installed || inStandalone) return null;

  return (
    <AnimatePresence>
      {visible && (canPromptInstall || showIOSHelp) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-end bg-black/40 p-4"
        >
          <motion.div
            initial={{ y: 36, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 36, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="safe-bottom glass w-full rounded-3xl p-5 shadow-soft"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <img
                  src="/icons/asound-brand.svg"
                  alt="ASound logo"
                  className="h-9 w-9 rounded-xl object-contain shadow-soft"
                />
                <div>
                  <p className="font-display text-base font-semibold">Install ASound</p>
                  <p className="text-xs text-muted">Hear With Us</p>
                </div>
              </div>
              <button
                onClick={() => setVisible(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-muted"
                aria-label="Close install prompt"
              >
                <HiOutlineXMark className="text-lg" />
              </button>
            </div>

            {canPromptInstall && (
              <button
                onClick={requestInstall}
                disabled={installing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-glow px-4 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
              >
                <HiOutlineArrowDownTray className="text-lg" />
                {installing ? "Preparing..." : "Install App"}
              </button>
            )}

            {showIOSHelp && (
              <div className="space-y-3 text-sm text-muted">
                <p>On iPhone Safari, install from browser menu:</p>
                <p className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-primary">
                  <HiOutlineShare className="text-lg" />
                  Tap Share, then "Add to Home Screen"
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PwaInstallPrompt;
