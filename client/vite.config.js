import { defineConfig } from "vite";
import { projectConfig } from "../project.config.js";

export default defineConfig({
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
