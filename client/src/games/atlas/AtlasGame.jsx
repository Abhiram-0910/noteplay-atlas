import { useState } from "react";

function remainingMs(gameState) {
  return gameState.remainingMs ?? Math.max(0, gameState.roundStartTime + gameState.roundTimeLimit - Date.now());
}

function feedbackTone(outcome) {
  if (["timeout", "invalid", "repeated", "wrong_letter"].includes(outcome)) {
    return "bad";
  }
  if (outcome === "accepted") {
    return "good";
  }
  return "neutral";
}

export default function AtlasGame({ gameState, me, onSubmitAnswer, onHowToPlay }) {
  const [answer, setAnswer] = useState("");
  const canSubmit = Boolean(me?.connected && !gameState.gameOver && gameState.currentTurn === me.playerId);
  const seconds = Math.ceil(remainingMs(gameState) / 1000);
  const progress = Math.max(0, Math.min(100, (remainingMs(gameState) / gameState.roundTimeLimit) * 100));
  const requiredLetter = gameState.requiredStartingLetter || "Any";
  const feedbackClass = feedbackTone(gameState.lastTurn?.outcome);
  const myLives = me ? gameState.playerLives?.[me.playerId] ?? 0 : null;
  const myScore = me ? gameState.playerScores?.[me.playerId] ?? 0 : 0;

  function submit(event) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed) {
      return;
    }
    onSubmitAnswer(trimmed);
    setAnswer("");
  }

  return (
    <section className="panel atlas-panel">
      <div className="atlas-header">
        <div>
          <p className="eyebrow">Atlas</p>
          <h2>{canSubmit ? "Your move" : "Watch the chain"}</h2>
        </div>
        <div className={`timer-chip atlas-timer ${seconds <= 5 ? "warning" : "active"}`}>{seconds}s</div>
      </div>

      <div className="badge-row">
        <span className="mini-badge">{gameState.categoryLabel}</span>
        <span className="mini-badge muted-badge">{gameState.matchModeLabel}</span>
        <span className="mini-badge muted-badge">{gameState.usedAnswerCount} used</span>
        {myLives !== null ? <span className={`mini-badge ${myLives <= 1 ? "danger-badge" : ""}`}>{myLives} lives</span> : null}
        <span className="mini-badge muted-badge">{myScore} valid</span>
      </div>

      <div className="atlas-focus-grid">
        <article className="atlas-focus-card atlas-letter-card">
          <p className="eyebrow">Required letter</p>
          <strong>{requiredLetter}</strong>
          <span>{requiredLetter === "Any" ? "Any valid start" : `Next answer begins with ${requiredLetter}`}</span>
        </article>
        <article className="atlas-focus-card atlas-answer-card">
          <p className="eyebrow">Previous answer</p>
          <strong>{gameState.previousAcceptedAnswer || "No answer yet"}</strong>
          <span>{gameState.previousAcceptedAnswer ? "The next turn follows its last letter." : "The first accepted answer opens the chain."}</span>
        </article>
      </div>

      <div className="atlas-timer-track" aria-hidden="true">
        <div className={`atlas-timer-bar ${seconds <= 5 ? "warning" : ""}`} style={{ width: `${progress}%` }} />
      </div>

      <p className={`atlas-feedback ${feedbackClass}`}>{gameState.lastMoveMessage}</p>

      <form className="answer-form atlas-answer-form" onSubmit={submit}>
        <input
          autoCapitalize="words"
          disabled={!canSubmit}
          inputMode="text"
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={requiredLetter === "Any" ? "Enter a place" : `Enter a place starting with ${requiredLetter}`}
          value={answer}
        />
        <button disabled={!canSubmit || answer.trim().length === 0} type="submit">Submit</button>
      </form>

      <div className="button-row">
        <button type="button" className="secondary" onClick={onHowToPlay}>How to Play</button>
      </div>

      <section className="atlas-recent">
        <div className="atlas-recent-header">
          <div>
            <p className="eyebrow">Recent answers</p>
            <h3>Latest chain</h3>
          </div>
        </div>
        <div className="atlas-answer-list">
          {gameState.recentAcceptedAnswers?.length ? (
            gameState.recentAcceptedAnswers.map((item) => (
              <article className="atlas-answer-chip" key={`${item.playerId}-${item.name}`}>
                <strong>{item.name}</strong>
                <span>{item.endingLetter}</span>
              </article>
            ))
          ) : (
            <p className="muted">No accepted answers yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}
