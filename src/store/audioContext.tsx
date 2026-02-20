import React, { createContext, useContext } from "react";
import { useAudioEngine } from "../hooks/useAudioEngine";

const AudioContext = createContext<ReturnType<typeof useAudioEngine> | null>(null);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const engine = useAudioEngine();
  return <AudioContext.Provider value={engine}>{children}</AudioContext.Provider>;
};

export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
};
