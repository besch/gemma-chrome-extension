import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        background: "src/background/index.ts",
        contentScript: "src/contentScript/index.ts",
        microphoneAccess: "src/microphone-access.ts",
        offscreen: "src/offscreen.ts",
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") {
            return "background.js";
          }
          if (chunkInfo.name === "contentScript") {
            return "contentScript.js";
          }
          if (chunkInfo.name === "microphoneAccess") {
            return "microphone-access.js";
          }
          if (chunkInfo.name === "offscreen") {
            return "offscreen.js";
          }
          return "assets/[name].js";
        },
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
});