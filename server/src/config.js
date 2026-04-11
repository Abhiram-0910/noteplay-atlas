import { projectConfig } from "../../project.config.js";

export const config = {
  port: Number.parseInt(process.env.PORT || String(projectConfig.serverPort), 10),
  clientOrigin: process.env.CLIENT_ORIGIN || `http://localhost:${projectConfig.clientPort}`,
  roomCodeLength: Number.parseInt(process.env.ROOM_CODE_LENGTH || "5", 10),
  roomTtlMs: Number.parseInt(process.env.ROOM_TTL_MS || String(90 * 60 * 1000), 10),
  cleanupIntervalMs: Number.parseInt(process.env.CLEANUP_INTERVAL_MS || String(5 * 60 * 1000), 10),
  chatMaxLength: Number.parseInt(process.env.CHAT_MAX_LENGTH || "200", 10),
  chatCooldownMs: Number.parseInt(process.env.CHAT_COOLDOWN_MS || "800", 10),
  atlasDatasetDir: process.env.ATLAS_DATASET_DIR || ""
};
