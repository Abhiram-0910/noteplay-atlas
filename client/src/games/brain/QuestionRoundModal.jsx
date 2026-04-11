import { useEffect, useMemo, useState } from "react";

function countdownSeconds(nextRoundAt, now) {
  if (!nextRoundAt) {
    return 0;
  }
  return Math.max(0, Math.ceil((nextRoundAt - now) / 1000));
}

export default function QuestionRoundModal({ gameState, players, onNextRound }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!gameState?.roundLocked || !gameState?.nextRoundAt || gameState?.gameOver) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [gameState?.roundLocked, gameState?.nextRoundAt, gameState?.gameOver]);

  const winner = useMemo(
    () => players.find((player) => player.playerId === gameState?.roundWinner) || null,
    [players, gameState?.roundWinner]
  );

  if (!gameState?.roundLocked || gameState?.gameOver || gameState?.revealedAnswer === null || gameState?.revealedAnswer === undefined) {
    return null;
  }

  const seconds = countdownSeconds(gameState.nextRoundAt, now);

  return (
    <div className="modal-backdrop round-summary-backdrop" role="presentation">
      <section className="modal round-summary-modal" role="dialog" aria-modal="true" aria-labelledby="round-summary-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Round summary</p>
            <h2 id="round-summary-title">
              {winner ? `${winner.playerName} won the round` : "No round winner"}
            </h2>
          </div>
        </div>

        <div className="summary-grid">
          <div>
            <p className="summary-label">Correct answer</p>
            <strong className="summary-value">{String(gameState.revealedAnswer)}</strong>
          </div>
          <div>
            <p className="summary-label">Points earned</p>
            <strong className="summary-value">{gameState.lastRoundPoints}</strong>
          </div>
        </div>

        {winner ? (
          <div className="summary-breakdown">
            <p>Base: +{gameState.lastRoundBasePoints}</p>
            <p>Speed: +{gameState.lastRoundSpeedBonus}</p>
            {gameState.lastRoundStreakBonus > 0 ? <p>Streak: +{gameState.lastRoundStreakBonus}</p> : null}
            {gameState.hintRevealed ? <p>Hint penalty applied</p> : null}
          </div>
        ) : (
          <p>No one answered correctly before the timer ended.</p>
        )}

        <div className="modal-actions">
          <button onClick={onNextRound} type="button">Next round now</button>
          <button className="secondary" disabled type="button">
            {seconds > 0 ? `Next round in ${seconds}s` : "Starting next round"}
          </button>
        </div>
      </section>
    </div>
  );
}
