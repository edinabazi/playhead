import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    main: {
      define: {
        "process.env.POSTHOG_PROJECT_API_KEY": JSON.stringify(env.POSTHOG_PROJECT_API_KEY || ""),
        "process.env.POSTHOG_HOST": JSON.stringify(env.POSTHOG_HOST || "https://eu.i.posthog.com"),
      },
      plugins: [externalizeDepsPlugin()],
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      resolve: {
        alias: {
          "@": resolve("src/renderer/src"),
        },
      },
      plugins: [react(), tailwindcss()],
    },
  };
});
