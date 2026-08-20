import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/live/numbeo": {
        target: "https://www.numbeo.com",
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/live\/numbeo/, "/cost-of-living/in"),
      },
    },
  },
});
