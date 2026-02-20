let wakeLock: WakeLockSentinel | null = null;

export const requestWakeLock = async () => {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    // Ignore if not allowed.
  }
};

export const releaseWakeLock = async () => {
  try {
    await wakeLock?.release();
  } finally {
    wakeLock = null;
  }
};
