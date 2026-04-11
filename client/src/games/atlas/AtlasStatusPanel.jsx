export default function AtlasStatusPanel({ gameState, players, playerId, roomState }) {
  const longestStreak = Math.max(0, ...Object.values(gameState.longestStreaks || { none: 0 }));

  return (
    <>
      <section className="panel-section atlas-status-panel">
        <p className="eyebrow">Atlas status</p>
        <h2>Players</h2>
        <div className="score-list atlas-score-list">
          {players.map((player) => {
            const lives = gameState.playerLives?.[player.playerId] ?? 0;
            const score = gameState.playerScores?.[player.playerId] ?? 0;
            const streak = gameState.streaks?.[player.playerId] ?? 0;
            const eliminated = gameState.eliminatedPlayers?.includes(player.playerId);
            return (
              <article className={`score-row atlas-score-row ${gameState.currentTurn === player.playerId ? "current" : ""}`} key={player.playerId}>
                <div className="atlas-player-copy">
                  <span>{player.playerName}{player.playerId === playerId ? " (you)" : ""}</span>
                  <div className="player-meta-row">
                    {player.playerId === roomState.hostPlayerId ? <span className="player-badge">Host</span> : null}
                    <span className={`player-badge ${player.connected ? "good" : "bad"}`}>{player.connected ? "Connected" : "Disconnected"}</span>
                    {eliminated ? <span className="player-badge bad">Out</span> : null}
                    {streak > 1 ? <span className="player-badge good">Streak x{streak}</span> : null}
                  </div>
                </div>
                <div className="atlas-player-metrics">
                  <strong>{lives}</strong>
                  <span>{lives === 1 ? "life" : "lives"}</span>
                  <small>{score} valid</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel-section atlas-meta-panel">
        <p className="eyebrow">Match</p>
        <h2>Chain</h2>
        <div className="info-card-grid compact-info-grid">
          <article className="info-card">
            <span>Category</span>
            <strong>{gameState.categoryLabel}</strong>
          </article>
          <article className="info-card">
            <span>Mode</span>
            <strong>{gameState.matchModeLabel}</strong>
          </article>
          <article className="info-card">
            <span>Used answers</span>
            <strong>{gameState.usedAnswerCount}</strong>
          </article>
          <article className="info-card">
            <span>Longest streak</span>
            <strong>{longestStreak}</strong>
          </article>
        </div>
      </section>
    </>
  );
}
