export const BOARD_SIZE = 8;
export const EMPTY_CELL = "";
export const GENERAL_MODE = "general";
export const SIMPLE_MODE = "simple";
export const VALID_MODES = new Set([GENERAL_MODE, SIMPLE_MODE]);
export const VALID_LETTERS = new Set(["S", "O"]);

const LINE_DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
];

export class GameRulesError extends Error {
  constructor(message) {
    super(message);
    this.name = "GameRulesError";
  }
}

export function normalizeMode(mode) {
  const normalized = String(mode || GENERAL_MODE).trim().toLowerCase();
  if (!VALID_MODES.has(normalized)) {
    throw new GameRulesError("Invalid mode. Choose general or simple.");
  }
  return normalized;
}

export function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => EMPTY_CELL));
}

export function copyBoard(board) {
  ensureValidBoard(board);
  return board.map((row) => [...row]);
}

export function ensureValidBoard(board) {
  if (!Array.isArray(board) || board.length !== BOARD_SIZE) {
    throw new GameRulesError("Board must be exactly 8x8.");
  }

  for (const row of board) {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) {
      throw new GameRulesError("Board must be exactly 8x8.");
    }

    for (const cell of row) {
      if (cell !== EMPTY_CELL && !VALID_LETTERS.has(cell)) {
        throw new GameRulesError("Board contains invalid cell values.");
      }
    }
  }
}

export function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function boardIsFull(board) {
  ensureValidBoard(board);
  return board.every((row) => row.every((cell) => cell !== EMPTY_CELL));
}

export function switchTurn(currentTurn, playerOrder) {
  if (!Array.isArray(playerOrder) || playerOrder.length !== 2) {
    throw new GameRulesError("Exactly two players are required.");
  }
  if (!playerOrder.includes(currentTurn)) {
    throw new GameRulesError("Current turn must belong to a player in the game.");
  }
  return playerOrder[0] === currentTurn ? playerOrder[1] : playerOrder[0];
}

export function decideWinner(scores) {
  const entries = Object.entries(scores || {});
  if (entries.length === 0) {
    return { winner: null, draw: true };
  }

  const highest = Math.max(...entries.map(([, score]) => score));
  const leaders = entries.filter(([, score]) => score === highest).map(([playerId]) => playerId);
  if (leaders.length !== 1) {
    return { winner: null, draw: true };
  }
  return { winner: leaders[0], draw: false };
}

function cellKey(cells) {
  return cells.map(([row, col]) => `${row},${col}`).join("|");
}

export function findNewSosSequences(board, row, col, letter) {
  ensureValidBoard(board);
  const normalizedLetter = String(letter || "").trim().toUpperCase();
  if (!VALID_LETTERS.has(normalizedLetter)) {
    throw new GameRulesError("Invalid letter. Choose S or O.");
  }
  if (!inBounds(row, col)) {
    throw new GameRulesError("Move is outside the board.");
  }

  const sequences = [];
  const seen = new Set();

  const addIfSos = (cells) => {
    if (!cells.every(([r, c]) => inBounds(r, c))) {
      return;
    }
    const value = cells.map(([r, c]) => board[r][c]).join("");
    const key = cellKey(cells);
    if (value === "SOS" && !seen.has(key)) {
      seen.add(key);
      sequences.push(cells);
    }
  };

  for (const [dr, dc] of LINE_DIRECTIONS) {
    if (normalizedLetter === "O") {
      addIfSos([
        [row - dr, col - dc],
        [row, col],
        [row + dr, col + dc]
      ]);
    } else {
      addIfSos([
        [row, col],
        [row + dr, col + dc],
        [row + 2 * dr, col + 2 * dc]
      ]);
      addIfSos([
        [row - 2 * dr, col - 2 * dc],
        [row - dr, col - dc],
        [row, col]
      ]);
    }
  }

  return sequences;
}

export function applyMove({
  board,
  row,
  col,
  letter,
  playerId,
  currentTurn,
  playerOrder,
  scores,
  mode = GENERAL_MODE,
  gameOver = false
}) {
  ensureValidBoard(board);
  const normalizedMode = normalizeMode(mode);
  const normalizedLetter = String(letter || "").trim().toUpperCase();

  if (gameOver) {
    throw new GameRulesError("The game is already over.");
  }
  if (!Array.isArray(playerOrder) || playerOrder.length !== 2) {
    throw new GameRulesError("Exactly two players are required.");
  }
  if (!playerOrder.includes(playerId)) {
    throw new GameRulesError("Player is not in this game.");
  }
  if (playerId !== currentTurn) {
    throw new GameRulesError("It is not your turn.");
  }
  if (!VALID_LETTERS.has(normalizedLetter)) {
    throw new GameRulesError("Invalid letter. Choose S or O.");
  }
  if (!inBounds(row, col)) {
    throw new GameRulesError("Move is outside the board.");
  }
  if (board[row][col] !== EMPTY_CELL) {
    throw new GameRulesError("That cell is already filled.");
  }

  const nextBoard = copyBoard(board);
  nextBoard[row][col] = normalizedLetter;
  const sequences = findNewSosSequences(nextBoard, row, col, normalizedLetter);
  const points = sequences.length;
  const nextScores = Object.fromEntries(playerOrder.map((id) => [id, Number(scores?.[id] || 0)]));
  nextScores[playerId] += points;

  let nextTurn = points > 0 ? currentTurn : switchTurn(currentTurn, playerOrder);
  let nextGameOver = false;
  let winner = null;
  let draw = false;

  if (normalizedMode === SIMPLE_MODE && points > 0) {
    nextGameOver = true;
    winner = playerId;
    nextTurn = playerId;
  } else if (boardIsFull(nextBoard)) {
    nextGameOver = true;
    const result = decideWinner(nextScores);
    winner = result.winner;
    draw = result.draw;
  }

  return {
    board: nextBoard,
    sequences,
    points,
    scores: nextScores,
    currentTurn: nextTurn,
    gameOver: nextGameOver,
    winner,
    draw
  };
}

