import { getGameInfo } from "../games/gameInfo.js";
import { ATLAS_CATEGORY_OPTIONS, ATLAS_MODE_LABEL } from "../games/atlas/atlasOptions.js";
import { projectConfig } from "../projectConfig.js";

export default function GameSelector({
  selectedGame,
  mode,
  atlasCategory,
  onSelectGame,
  disabled,
  framed = true
}) {
  const lockedGame = getGameInfo(projectConfig.gameId);
  const normalizedSelectedGame = getGameInfo(selectedGame || projectConfig.gameId).id;

  return (
    <section className={`game-selector ${framed ? "panel-section" : ""}`.trim()} aria-label="Game setup">
      <h2>Game setup</h2>
      <div className="game-card-grid">
        <article className={`game-card ${normalizedSelectedGame === lockedGame.id ? "selected" : ""}`} key={lockedGame.id}>
          <strong>{lockedGame.shortTitle}</strong>
          <span>{lockedGame.description}</span>
        </article>
      </div>
      {lockedGame.id === "sos" && (
        <label className="mode-control">
          SOS mode
          <select
            disabled={disabled}
            onChange={(event) => onSelectGame(lockedGame.id, { mode: event.target.value, atlasCategory })}
            value={mode}
          >
            <option value="general">General Mode</option>
            <option value="simple">Simple Mode</option>
          </select>
        </label>
      )}
      {lockedGame.id === "atlas" && (
        <div className="setup-tiles atlas-category-picker" aria-label="Atlas category">
          <div className="selector-copy">
            <p className="eyebrow">Atlas category</p>
            <p>Select the geography pool before the room starts.</p>
          </div>
          <div className="tile-grid">
            {ATLAS_CATEGORY_OPTIONS.map((option) => (
              <button
                className={`setup-tile ${atlasCategory === option.id ? "selected" : ""}`}
                disabled={disabled}
                key={option.id}
                onClick={() => onSelectGame(lockedGame.id, { mode, atlasCategory: option.id })}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
          <p className="status-text atlas-mode-note">Mode: {ATLAS_MODE_LABEL}</p>
        </div>
      )}
      {lockedGame.id === "brain" ? (
        <p className="status-text atlas-mode-note">This build is locked to Brain Battle.</p>
      ) : null}
    </section>
  );
}
