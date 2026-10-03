import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/travel-planner/",
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("firebase")) return "firebase";
            if (id.includes("leaflet")) return "map";
            if (id.includes("temporal") || id.includes("jsbi")) return "time";
            if (id.includes("react")) return "react";
          }
        },
      },
    },
  },
});
