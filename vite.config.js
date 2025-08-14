import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5001", // backend poort
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(
      process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:5001" // dev backend
        : "http://127.0.0.1:5001" // prod backend
    ),
  },
});
