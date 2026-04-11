import { getGameInfo } from "../games/gameInfo.js";

export default function RulesModal({
  open,
  selectedGame = "sos",
  onClose,
  onStart,
  startDisabled = false,
  startLabel = "Start Game"
}) {
  if (!open) {
    return null;
  }

  const info = getGameInfo(selectedGame);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <div className="modal-header">
          <div>
            <p className="eyebrow">How to play</p>
            <h2 id="rules-title">{info.title}</h2>
          </div>
          <button type="button" className="secondary compact" onClick={onClose}>Close</button>
        </div>

        <p>{info.description}</p>

        <h3>Rules</h3>
        <ol>
          {info.rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ol>

        <h3>Scoring</h3>
        <p>{info.scoring}</p>

        <h3>Match setup</h3>
        <p>{info.rounds}. {info.timer}.</p>

        <div className="modal-actions">
          <button type="button" onClick={onStart || onClose} disabled={startDisabled}>{startLabel}</button>
        </div>
      </section>
    </div>
  );
}
