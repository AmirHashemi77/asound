import { registerSW as register } from "virtual:pwa-register";

export const registerSW = () => {
  register({
    onNeedRefresh() {
      console.info("New content available; refresh to update.");
    },
    onOfflineReady() {
      console.info("App ready to work offline.");
    }
  });
};
