import { getGameSettingSummary } from "../games/gameInfo.js";

export default function ResultModal({
  roomState,
  playerId,
  onClose,
  onRematchRequest,
  onRematchAccept,
  onBackToLobby,
  onLeave
}) {
  if (!roomState.gameOver) {
    return null;
  }

  const votes = new Set(roomState.rematchVotes || []);
  const hasMyVote = votes.has(playerId);
  const hasOtherVote = votes.size > 0 && !hasMyVote;
  const isHost = roomState.hostPlayerId === playerId;
  const title = roomState.draw ? "Draw" : `${roomState.winnerName || "Player"} wins`;
  const gameState = roomState.currentGameState || {};
  const isAtlasGame = roomState.selectedGame === "atlas";
  const gameSettings = getGameSettingSummary(roomState.selectedGame, roomState.gameSettings);
  const longestStreak = Math.max(0, ...Object.values(gameState.longestStreaks || { none: 0 }));
  const bodyText = roomState.draw
    ? "Both players finished with the same score."
    : isAtlasGame
      ? `${roomState.winnerName} is the last remaining player.`
      : `${roomState.winnerName} had the highest score.`;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Result</p>
            <h2 id="result-title">{title}</h2>
          </div>
          <button type="button" className="secondary compact" onClick={onClose}>Close</button>
        </div>
        <p>{bodyText}</p>
        {isAtlasGame ? (
          <div className="summary-grid atlas-result-grid">
            <div>
              <p className="summary-label">Category</p>
              <strong className="summary-value">{gameSettings.categoryLabel}</strong>
            </div>
            <div>
              <p className="summary-label">Mode</p>
              <strong className="summary-value">{gameSettings.modeLabel}</strong>
            </div>
            <div>
              <p className="summary-label">Valid answers</p>
              <strong className="summary-value">{gameState.totalValidAnswers || 0}</strong>
            </div>
            <div>
              <p className="summary-label">Longest streak</p>
              <strong className="summary-value">{longestStreak}</strong>
            </div>
          </div>
        ) : null}
        {gameState.summaryText ? <p>{gameState.summaryText}</p> : null}
        <div className="modal-actions">
          {hasOtherVote ? (
            <button type="button" onClick={onRematchAccept}>Accept rematch</button>
          ) : (
            <button type="button" onClick={onRematchRequest} disabled={hasMyVote}>
              {hasMyVote ? "Waiting for rematch" : "Request rematch"}
            </button>
          )}
          <button type="button" className="secondary" onClick={onBackToLobby} disabled={!isHost}>
            {isHost ? "Back to Lobby" : "Host returns to lobby"}
          </button>
          <button type="button" className="secondary" onClick={onLeave}>Leave room</button>
        </div>
      </section>
    </div>
  );
}
