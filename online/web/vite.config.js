import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "page-timetable": [
            "./src/pages/Generate",
            "./src/pages/Review",
            "./src/pages/Export",
          ],
          "page-daily-ops": [
            "./src/pages/DutyRoster",
            "./src/pages/Committees",
            "./src/pages/ExamDuties",
            "./src/pages/WorkloadPage",
            "./src/pages/SubstitutionPage",
          ],
        },
      },
    },
    minify: true,
  },
  server: {
    port: 3987,
    strictPort: false,
    host: false,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
