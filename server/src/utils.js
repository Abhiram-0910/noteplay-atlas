import crypto from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5) {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function generateId() {
  return crypto.randomUUID();
}

export function cleanPlayerName(playerName) {
  const trimmed = String(playerName || "").trim();
  return trimmed ? trimmed.slice(0, 32) : "Player";
}

export function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

export function nowIso() {
  return new Date().toISOString();
}

