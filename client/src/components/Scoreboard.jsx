export default function Scoreboard({ players, currentTurn, playerId }) {
  return (
    <section className="scoreboard panel-section" aria-label="Scoreboard">
      <h2>Scores</h2>
      <div className="score-list">
        {players.map((player) => (
          <div className={`score-row ${currentTurn === player.playerId ? "current" : ""}`} key={player.playerId}>
            <span>{player.playerName}{player.playerId === playerId ? " (you)" : ""}</span>
            <strong>{player.score}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

