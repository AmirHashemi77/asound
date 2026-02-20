import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  lowPowerMode: boolean;
  autoImport: boolean;
  volume: number;
  setLowPowerMode: (value: boolean) => void;
  setAutoImport: (value: boolean) => void;
  setVolume: (value: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lowPowerMode: false,
      autoImport: true,
      volume: 0.9,
      setLowPowerMode: (value) => set({ lowPowerMode: value }),
      setAutoImport: (value) => set({ autoImport: value }),
      setVolume: (value) => set({ volume: Math.min(1, Math.max(0, value)) })
    }),
    { name: "player-settings" }
  )
);
