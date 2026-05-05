/// <reference types="vite/client" />

import type { PlayheadApi } from "../../shared/library";

declare global {
  interface Window {
    playhead: PlayheadApi;
  }
}
