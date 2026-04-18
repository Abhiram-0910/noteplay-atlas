import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { projectConfig } from "../project.config.js";

export default defineConfig({
  plugins: [react()],
  publicDir: "../public",
  server: {
    host: "0.0.0.0",
    port: projectConfig.clientPort
  },
  preview: {
    host: "0.0.0.0",
    port: projectConfig.clientPort
  }
});
