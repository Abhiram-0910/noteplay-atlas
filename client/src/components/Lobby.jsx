import { useState } from "react";
import ChatBox from "./ChatBox.jsx";
import GameSelector from "./GameSelector.jsx";
import RoomQrCard from "./RoomQrCard.jsx";
import RulesModal from "./RulesModal.jsx";
import UtilityPanel from "./UtilityPanel.jsx";
import { getGameInfo, getGameSettingSummary } from "../games/gameInfo.js";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

export default function Lobby({
  roomState,
  playerId,
  chatMessages,
  sendChatMessage,
  selectGame,
  setReady,
  startGame,
  status,
  leaveRoom
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const me = roomState.players.find((player) => player.playerId === playerId);
  const isCompact = useMediaQuery("(max-width: 899px)");
  const isHost = roomState.hostPlayerId === playerId;
  const hasTwoPlayers = roomState.players.length === 2;
  const guestsReady = hasTwoPlayers && roomState.players
    .filter((player) => player.playerId !== roomState.hostPlayerId)
    .every((player) => player.ready && player.connected);
  const canStart = isHost && guestsReady && roomState.players.every((player) => player.connected);
  const gameInfo = getGameInfo(roomState.selectedGame);
  const gameSettingSummary = getGameSettingSummary(roomState.selectedGame, roomState.gameSettings);

  async function copyRoomCode() {
    try {
      await navigator.clipboard?.writeText(roomState.roomCode);
    } catch {
      // The room code is already visible if clipboard access is unavailable.
    }
  }

  return (
    <div className="lobby-layout">
      <section className="panel lobby-panel">
        <p className="eyebrow">Lobby</p>
        <div className="room-code-card">
          <span>ROOM CODE</span>
          <strong>{roomState.roomCode}</strong>
        </div>
        <p>{hasTwoPlayers ? `${isHost ? "You are the host. Start when the joined player is ready." : "Mark ready when you are set."}` : "Waiting for a second player to join."}</p>
        <div className="button-row">
          <button type="button" onClick={copyRoomCode}>Copy room code</button>
          <button type="button" className="secondary" onClick={() => setRulesOpen(true)}>How to Play</button>
        </div>

        <RoomQrCard roomCode={roomState.roomCode} />

        <GameSelector
          atlasCategory={roomState.gameSettings?.atlasCategory}
          disabled={!isHost || (roomState.gameStarted && !roomState.gameOver)}
          mode={roomState.gameSettings?.sosMode || roomState.mode}
          onSelectGame={selectGame}
          selectedGame={roomState.selectedGame}
        />
      </section>

      <aside className="lobby-side-column">
        <section className="panel-section players-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Players</p>
              <h2>Room status</h2>
            </div>
          </div>

          <div className="player-cards">
            {roomState.players.map((player) => (
              <article className="player-card" key={player.playerId}>
                <strong>{player.playerName}{player.playerId === playerId ? " (you)" : ""}</strong>
                <div className="player-meta-row">
                  {player.playerId === roomState.hostPlayerId && <span className="player-badge">Host</span>}
                  <span className={`player-badge ${player.connected ? "good" : "bad"}`}>{player.connected ? "Connected" : "Disconnected"}</span>
                  <span className={`player-badge ${player.ready ? "good" : ""}`}>{player.ready ? "Ready" : "Not ready"}</span>
                </div>
              </article>
            ))}
            {!hasTwoPlayers && <article className="player-card muted">Waiting for opponent</article>}
          </div>

          <div className="button-row">
            {!isHost && (
              <button type="button" onClick={() => setReady(!me?.ready)} disabled={!me}>
                {me?.ready ? "Set not ready" : "Ready"}
              </button>
            )}
            {isHost && <button type="button" onClick={() => setRulesOpen(true)} disabled={!canStart}>Review rules</button>}
            <button type="button" className="secondary" onClick={leaveRoom}>Leave room</button>
          </div>
          <p className="status-text">{status}</p>
        </section>

        <section className="panel rules-panel">
          <p className="eyebrow">Selected game</p>
          <h2>{gameInfo.title}</h2>
          <p>{gameInfo.description}</p>
          {(gameSettingSummary.modeLabel || gameSettingSummary.categoryLabel) ? (
            <div className="info-card-grid compact-info-grid">
              {gameSettingSummary.modeLabel ? (
                <article className="info-card">
                  <span>Mode</span>
                  <strong>{gameSettingSummary.modeLabel}</strong>
                </article>
              ) : null}
              {gameSettingSummary.categoryLabel ? (
                <article className="info-card">
                  <span>Category</span>
                  <strong>{gameSettingSummary.categoryLabel}</strong>
                </article>
              ) : null}
            </div>
          ) : null}
          <p><strong>Scoring:</strong> {gameInfo.scoring}</p>
          <p><strong>Rounds:</strong> {gameInfo.rounds}</p>
          <p><strong>Timer:</strong> {gameInfo.timer}</p>
          <ol>
            {gameInfo.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </section>

        <UtilityPanel collapsible={isCompact} defaultOpen={!isCompact} eyebrow="Chat" title="Room chat">
          <ChatBox
            disabled={!me?.connected}
            framed={false}
            messages={chatMessages}
            onSend={sendChatMessage}
            playerId={playerId}
            showHeading={false}
          />
        </UtilityPanel>
      </aside>

      <RulesModal
        open={rulesOpen}
        selectedGame={roomState.selectedGame}
        onClose={() => setRulesOpen(false)}
        onStart={() => {
          setRulesOpen(false);
          startGame();
        }}
        startDisabled={!canStart}
        startLabel={isHost ? (canStart ? "Start Game" : "Waiting for joined player") : "Host starts the game"}
      />
    </div>
  );
}
