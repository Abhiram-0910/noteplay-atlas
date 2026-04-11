export default function StatusBar({ connected, roomState, playerId, status }) {
  const currentPlayer = roomState.players.find((player) => player.playerId === roomState.currentTurn);
  const gameLabel = roomState.selectedGameLabel || "Game";
  const gameState = roomState.currentGameState;
  const atlasLetter = gameState?.requiredStartingLetter || "Any";
  let turnText = "Waiting for opponent";
  if (roomState.gameOver) {
    turnText = `${gameLabel} complete`;
  } else if (roomState.gameStarted) {
    if (roomState.selectedGame === "sos") {
      turnText = roomState.currentTurn === playerId ? "Your turn" : `${currentPlayer?.playerName || "Opponent"}'s turn`;
    } else if (roomState.selectedGame === "atlas" && gameState) {
      const seconds = gameState.remainingMs === undefined ? null : Math.ceil(gameState.remainingMs / 1000);
      const actor = roomState.currentTurn === playerId ? "Your turn" : `${currentPlayer?.playerName || "Opponent"}'s turn`;
      turnText = seconds === null
        ? `${actor} - ${atlasLetter}`
        : `${actor} - ${atlasLetter} - ${seconds}s`;
    } else if (gameState) {
      const seconds = gameState.remainingMs === undefined ? null : Math.ceil(gameState.remainingMs / 1000);
      turnText = seconds === null
        ? `${gameLabel}: round ${gameState.currentRound} of ${gameState.totalRounds}`
        : `${gameLabel}: round ${gameState.currentRound} of ${gameState.totalRounds} - ${seconds}s`;
    } else {
      turnText = `${gameLabel} in progress`;
    }
  } else if (roomState.players.length === 2) {
    turnText = `${gameLabel} ready check`;
  }

  return (
    <header className="status-bar">
      <div>
        <p className="eyebrow">Room</p>
        <h1>{roomState.roomCode}</h1>
        <p className="status-text">{gameLabel}</p>
      </div>
      <div>
        <p className={`connection ${connected ? "ok" : "bad"}`}>{connected ? "Connected" : "Reconnecting"}</p>
        <p className="turn-text">{turnText}</p>
        <p className="status-text">{status}</p>
      </div>
    </header>
  );
}
