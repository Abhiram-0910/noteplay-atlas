import { applyMove, createBoard, GENERAL_MODE, normalizeMode } from "./gameLogic.js";

export const SOS_GAME = "sos";

export function createSosState({ playerOrder, mode = GENERAL_MODE }) {
  return {
    gameType: SOS_GAME,
    mode: normalizeMode(mode),
    board: createBoard(),
    playerScores: Object.fromEntries(playerOrder.map((playerId) => [playerId, 0])),
    currentTurn: playerOrder[0] || null,
    gameOver: false,
    winner: null,
    draw: false,
    lastMove: null,
    latestSosLines: [],
    lastMoveMessage: "SOS game started."
  };
}

export function applySosMove(state, { row, col, letter, playerId, playerOrder, playerName }) {
  const result = applyMove({
    board: state.board,
    row,
    col,
    letter,
    playerId,
    currentTurn: state.currentTurn,
    playerOrder,
    scores: state.playerScores,
    mode: state.mode,
    gameOver: state.gameOver
  });

  return {
    ...state,
    board: result.board,
    playerScores: result.scores,
    currentTurn: result.currentTurn,
    gameOver: result.gameOver,
    winner: result.winner,
    draw: result.draw,
    lastMove: {
      row,
      col,
      letter: String(letter || "").trim().toUpperCase(),
      playerId,
      playerName,
      points: result.points
    },
    latestSosLines: result.sequences,
    lastMoveMessage: result.points > 0
      ? `${playerName} made ${result.points} SOS, play again.`
      : "No SOS, opponent's turn."
  };
}

export function publicSosState(state) {
  return { ...state };
}

