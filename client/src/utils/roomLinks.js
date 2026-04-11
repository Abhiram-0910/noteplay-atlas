export function normalizeRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function getRoomCodeFromUrl(location = window.location) {
  const params = new URLSearchParams(location.search);
  const fromQuery = normalizeRoomCode(params.get("room"));
  if (fromQuery) {
    return fromQuery;
  }

  const match = location.pathname.match(/\/(?:join|room)\/([A-Za-z0-9]+)/);
  return match ? normalizeRoomCode(match[1]) : "";
}

export function buildJoinUrl(roomCode, origin = window.location.origin) {
  return `${origin}/join?room=${encodeURIComponent(normalizeRoomCode(roomCode))}`;
}
