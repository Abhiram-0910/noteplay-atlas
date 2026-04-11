import Board from "./Board.jsx";
import LetterPicker from "./LetterPicker.jsx";

function moveStatus(gameState, playerId) {
  const lastMove = gameState?.lastMove;
  if (!lastMove) {
    return gameState?.lastMoveMessage || "";
  }
  if (lastMove.points > 0) {
    return lastMove.playerId === playerId
      ? `You made ${lastMove.points} SOS, play again.`
      : `${lastMove.playerName} made ${lastMove.points} SOS and plays again.`;
  }
  return gameState.currentTurn === playerId ? "No SOS, your turn." : "No SOS, opponent's turn.";
}

export default function SOSBoard({ gameState, me, playerId, selectedLetter, setSelectedLetter, makeMove, onHowToPlay }) {
  const canMove = Boolean(me?.connected && !gameState?.gameOver && gameState?.currentTurn === playerId);

  return (
    <div className="panel board-panel">
      <div className="game-actions">
        <LetterPicker disabled={!me?.connected} selectedLetter={selectedLetter} setSelectedLetter={setSelectedLetter} />
        <button type="button" className="secondary" onClick={onHowToPlay}>How to Play</button>
      </div>
      <p className="move-status">{moveStatus(gameState, playerId)}</p>
      <Board
        board={gameState.board}
        canMove={canMove}
        lastMove={gameState.lastMove}
        onMove={makeMove}
        sosLines={gameState.latestSosLines}
      />
    </div>
  );
}
