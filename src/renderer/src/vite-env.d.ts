/// <reference types="vite/client" />

import type { PlayheadApi } from "../../shared/library";

declare global {
  const __APP_VERSION__: string;

  interface Window {
    playhead: PlayheadApi;
  }
}
