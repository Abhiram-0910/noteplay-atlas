import { useState } from "react";
import GameSelector from "../components/GameSelector.jsx";
import RulesModal from "../components/RulesModal.jsx";
import { getGameInfo, getGameSettingSummary } from "../games/gameInfo.js";
import { getRoomCodeFromUrl, normalizeRoomCode } from "../utils/roomLinks.js";
import { projectConfig } from "../projectConfig.js";

export default function HomePage({ connected, connectionState, createRoom, joinRoom, playerName, serverUrl, setPlayerName, setServerUrl, status }) {
  const [mode, setMode] = useState("general");
  const [atlasCategory, setAtlasCategory] = useState("mixed");
  const [roomCode, setRoomCode] = useState(getRoomCodeFromUrl);
  const [rulesOpen, setRulesOpen] = useState(false);
  const qrJoin = Boolean(roomCode);
  const selectedGame = projectConfig.gameId;
  const selectedInfo = getGameInfo(selectedGame);
  const selectedSettings = getGameSettingSummary(selectedGame, { sosMode: mode, atlasCategory });
  const defaultServerPlaceholder = `http://localhost:${projectConfig.serverPort}`;
  const connectionLabel = connected
    ? "Connected to server"
    : connectionState === "connecting"
      ? "Checking server"
      : connectionState === "reconnecting"
        ? "Reconnecting"
        : connectionState === "error"
          ? "Server unreachable"
          : "Server not checked";

  function handleSelectGame(_nextGame, nextOptions = {}) {
    if (nextOptions.mode) {
      setMode(nextOptions.mode);
    }
    if (nextOptions.atlasCategory) {
      setAtlasCategory(nextOptions.atlasCategory);
    }
  }

  return (
    <main className="home-page">
      <section className="panel home-card">
        <p className="eyebrow">Two-player live room</p>
        <h1>{projectConfig.appName}</h1>
        <p className="lead">
          {qrJoin
            ? `Room ${roomCode} is ready for ${selectedInfo.title}. Enter your name and join.`
            : `This build runs only ${selectedInfo.title}. Set your name, review the game setup, and open a shared room.`}
        </p>

        {!qrJoin && (
          <GameSelector
            atlasCategory={atlasCategory}
            disabled={false}
            framed={false}
            mode={mode}
            onSelectGame={handleSelectGame}
            selectedGame={selectedGame}
          />
        )}

        <label>
          Player name
          <input maxLength={32} onChange={(event) => setPlayerName(event.target.value)} placeholder="Your name" value={playerName} />
        </label>

        <label>
          Server URL
          <input onChange={(event) => setServerUrl(event.target.value)} placeholder={defaultServerPlaceholder} value={serverUrl} />
        </label>

        {!qrJoin && (
          <button
            type="button"
            onClick={() => createRoom({
              nextPlayerName: playerName,
              settings: { sosMode: mode, atlasCategory }
            })}
          >
            Create room
          </button>
        )}

        <div className="join-row">
          <label>
            Room code
            <input
              autoCapitalize="characters"
              maxLength={8}
              onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
              placeholder="ABCDE"
              value={roomCode}
            />
          </label>
          <button type="button" onClick={() => joinRoom({ nextPlayerName: playerName, nextRoomCode: roomCode })}>Join room</button>
        </div>

        <button type="button" className="secondary" onClick={() => setRulesOpen(true)}>Read rules</button>
      </section>

      <aside className="home-side-column">
        <section className="panel rules-panel">
          <p className="eyebrow">Game</p>
          <h2>{selectedInfo.title}</h2>
          <p>{selectedInfo.description}</p>
          <div className="info-card-grid">
            <article className="info-card">
              <span>Scoring</span>
              <strong>{selectedInfo.scoring}</strong>
            </article>
            <article className="info-card">
              <span>Match setup</span>
              <strong>{selectedInfo.rounds}. {selectedInfo.timer}.</strong>
            </article>
            {selectedSettings.modeLabel ? (
              <article className="info-card">
                <span>Mode</span>
                <strong>{selectedSettings.modeLabel}</strong>
              </article>
            ) : null}
            {selectedSettings.categoryLabel ? (
              <article className="info-card">
                <span>Category</span>
                <strong>{selectedSettings.categoryLabel}</strong>
              </article>
            ) : null}
          </div>
        </section>

        <section className="panel panel-section">
          <p className="eyebrow">Room flow</p>
          <ol className="compact-list">
            <li>Enter your name and review the game setup.</li>
            <li>Create a room or join by code.</li>
            <li>Share the code or QR link with the second player.</li>
            <li>Ready up and start when both players are connected.</li>
          </ol>
        </section>

        <section className="panel panel-section">
          <p className="eyebrow">Connection</p>
          <p className={`connection ${connected ? "ok" : connectionState === "idle" ? "" : "bad"}`.trim()}>{connectionLabel}</p>
          <p className="status-text">{status}</p>
        </section>
      </aside>

      <RulesModal open={rulesOpen} selectedGame={selectedGame} onClose={() => setRulesOpen(false)} startLabel="Continue" />
    </main>
  );
}
