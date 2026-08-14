import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        notFound: resolve(__dirname, "404.html"),
        about: resolve(__dirname, "about/index.html"),
        player: resolve(__dirname, "player/index.html"),
        submissions: resolve(__dirname, "submissions/index.html"),
      },
    },
  },
});
