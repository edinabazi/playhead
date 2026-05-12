import { resolve } from "node:path";
import { createRequire } from "node:module";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { loadEnv } from "vite";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json") as { version: string };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    main: {
      define: {
        "process.env.POSTHOG_PROJECT_API_KEY": JSON.stringify(env.POSTHOG_PROJECT_API_KEY || ""),
        "process.env.POSTHOG_HOST": JSON.stringify(env.POSTHOG_HOST || "https://eu.i.posthog.com"),
        "process.env.LASTFM_API_KEY": JSON.stringify(env.LASTFM_API_KEY || ""),
        "process.env.LASTFM_SHARED_SECRET": JSON.stringify(env.LASTFM_SHARED_SECRET || ""),
      },
      plugins: [externalizeDepsPlugin()],
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
      },
      resolve: {
        alias: {
          "@": resolve("src/renderer/src"),
        },
      },
      plugins: [react(), tailwindcss()],
    },
  };
});
