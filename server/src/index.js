import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.js";
import { attachSocketServer, roomManager } from "./socket.js";
import { DATA_PACK_DIR, DEFAULT_DATA_DIR } from "./shared/datasetLoader.js";
import { projectConfig } from "../../project.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const corsOrigins = config.clientOrigin === "*"
  ? "*"
  : config.clientOrigin.split(",").map((o) => o.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOrigins === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

app.use(express.json());
app.use("/dataset-assets/data", express.static(DEFAULT_DATA_DIR));
app.use("/dataset-assets/pack", express.static(DATA_PACK_DIR));
app.get("/api/health", (_req, res) => res.json({ status: "ok", rooms: roomManager.roomCount() }));

const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/socket.io") && !req.path.startsWith("/dataset-assets")) {
      res.sendFile(path.join(clientDist, "index.html"));
    }
  });
}

const httpServer = http.createServer(app);
attachSocketServer(httpServer);
httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`${projectConfig.appName} server on port ${config.port}`);
});
