import { useState } from "react";

function remainingSeconds(gameState) {
  const remainingMs = gameState.remainingMs ?? Math.max(0, gameState.roundStartTime + gameState.roundTimeLimit - Date.now());
  return Math.ceil(remainingMs / 1000);
}

function resolveQuestionImage(imageUrl, serverUrl) {
  if (!imageUrl || imageUrl.startsWith("http") || imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  return `${String(serverUrl || "").replace(/\/$/, "")}${imageUrl}`;
}

function labelType(type) {
  const value = String(type || "question").toLowerCase();
  if (value === "riddle") return "Riddle";
  if (value === "aots") return "AOTS";
  if (value === "aptitude") return "Aptitude";
  if (value === "math") return "Math";
  if (value === "logic") return "Logic";
  return "Brain";
}

export default function BrainGame({
  gameState,
  feedbackMessage,
  me,
  players = [],
  onSubmitAnswer,
  onNextRound,
  onHowToPlay,
  onUseHint,
  serverUrl
}) {
  const [answer, setAnswer] = useState("");
  const locked = gameState.roundLocked || gameState.gameOver;
  const question = gameState.currentQuestion;
  const questionImage = resolveQuestionImage(question.imageUrl, serverUrl);
  const myStreak = me ? gameState.streaks?.[me.playerId] || 0 : 0;

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
    <section className="panel question-panel">
      <div className="question-header">
        <div>
          <p className="eyebrow">Brain Battle</p>
          <h2>Round {gameState.currentRound} of {gameState.totalRounds}</h2>
        </div>
        <div className={`timer-chip ${locked ? "locked" : "active"}`}>{locked ? "Locked" : `${remainingSeconds(gameState)}s`}</div>
      </div>

      <div className="badge-row">
        <span className="mini-badge">{labelType(question.type)}</span>
        {question.difficulty && <span className="mini-badge muted-badge">{question.difficulty}</span>}
        {question.category && <span className="mini-badge muted-badge">{question.category}</span>}
        {myStreak > 1 && <span className="mini-badge">Streak x{myStreak}</span>}
      </div>

      <p className="question-text">{question.question}</p>
      {questionImage && (
        <figure className="question-figure">
          <img alt={question.imageDescription || "Question visual"} src={questionImage} />
          {question.imageDescription && <figcaption>{question.imageDescription}</figcaption>}
        </figure>
      )}

      {question.hint && <p className="hint">Hint: {question.hint}</p>}
      {!question.hint && question.hasHint && (
        <button
          className="secondary"
          disabled={!me?.connected || locked || gameState.hintRevealed}
          onClick={onUseHint}
          type="button"
        >
          Reveal hint (-points)
        </button>
      )}

      {feedbackMessage ? <p className="answer-feedback">{feedbackMessage}</p> : null}

      <form className="answer-form" onSubmit={submit}>
        <input
          disabled={!me?.connected || locked}
          inputMode="text"
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type your answer"
          value={answer}
        />
        <button disabled={!me?.connected || locked || answer.trim().length === 0} type="submit">Submit</button>
      </form>

      <div className="button-row">
        <button type="button" className="secondary" onClick={onHowToPlay}>How to Play</button>
        <button type="button" disabled={!gameState.roundLocked || gameState.gameOver} onClick={onNextRound}>Skip wait</button>
      </div>
    </section>
  );
}
