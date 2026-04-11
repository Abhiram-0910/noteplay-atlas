import { ATLAS_CATEGORY_LABELS, ATLAS_CATEGORY_MIXED } from "./datasetAdapter.js";
import {
  ATLAS_VALIDATION_REASON_ALREADY_USED,
  ATLAS_VALIDATION_REASON_EMPTY_ANSWER,
  ATLAS_VALIDATION_REASON_INVALID_CATEGORY_ENTRY,
  ATLAS_VALIDATION_REASON_PLACE_NOT_FOUND,
  ATLAS_VALIDATION_REASON_TIMEOUT,
  ATLAS_VALIDATION_REASON_WRONG_STARTING_LETTER,
  validateAtlasAnswer
} from "./atlasValidator.js";

export const ATLAS_GAME = "atlas";
export const ATLAS_MATCH_MODE_LIVES = "lives";
export const ATLAS_MATCH_MODE_LABELS = {
  [ATLAS_MATCH_MODE_LIVES]: "Lives"
};
export const ATLAS_STARTING_LIVES = 3;
export const ATLAS_TURN_TIME_LIMIT_MS = 20_000;
export const ATLAS_RECENT_ANSWERS_LIMIT = 8;

export class AtlasRulesError extends Error {
  constructor(message) {
    super(message);
    this.name = "AtlasRulesError";
  }
}

function createCountMap(playerOrder, startingValue = 0) {
  return Object.fromEntries(playerOrder.map((playerId) => [playerId, startingValue]));
}

function activePlayerIds(playerOrder, eliminatedPlayers) {
  return playerOrder.filter((playerId) => !eliminatedPlayers.includes(playerId));
}

function nextActiveTurnIndex(playerOrder, currentIndex, eliminatedPlayers) {
  for (let step = 1; step <= playerOrder.length; step += 1) {
    const candidateIndex = (currentIndex + step) % playerOrder.length;
    const candidateId = playerOrder[candidateIndex];
    if (!eliminatedPlayers.includes(candidateId)) {
      return candidateIndex;
    }
  }
  return currentIndex;
}

function playerLabel(playerName) {
  return playerName || "Player";
}

function reasonToOutcome(reason) {
  if (reason === ATLAS_VALIDATION_REASON_TIMEOUT) {
    return "timeout";
  }
  if (reason === ATLAS_VALIDATION_REASON_ALREADY_USED) {
    return "repeated";
  }
  if (reason === ATLAS_VALIDATION_REASON_WRONG_STARTING_LETTER) {
    return "wrong_letter";
  }
  return "invalid";
}

function buildAcceptedMessage({ playerName, answer, nextLetter }) {
  return `${playerLabel(playerName)} played ${answer}. Next letter ${nextLetter}.`;
}

function buildPenaltyMessage({ reason, playerName, requiredLetter, remainingLives, eliminated, categoryLabel }) {
  const actor = playerLabel(playerName);
  let message = `${actor} lost 1 life.`;

  if (reason === ATLAS_VALIDATION_REASON_TIMEOUT) {
    message = `${actor} ran out of time and lost 1 life.`;
  } else if (reason === ATLAS_VALIDATION_REASON_ALREADY_USED) {
    message = `${actor} repeated a used place and lost 1 life.`;
  } else if (reason === ATLAS_VALIDATION_REASON_WRONG_STARTING_LETTER) {
    message = `${actor} missed the required letter ${requiredLetter} and lost 1 life.`;
  } else if (reason === ATLAS_VALIDATION_REASON_EMPTY_ANSWER) {
    message = `${actor} submitted an empty answer and lost 1 life.`;
  } else if (reason === ATLAS_VALIDATION_REASON_PLACE_NOT_FOUND) {
    message = `${actor} entered a place that is not in the active dataset and lost 1 life.`;
  } else if (reason === ATLAS_VALIDATION_REASON_INVALID_CATEGORY_ENTRY) {
    message = `${actor} entered a place outside ${categoryLabel || "the active category"} and lost 1 life.`;
  } else {
    message = `${actor} entered an invalid place and lost 1 life.`;
  }

  if (eliminated) {
    message += " Eliminated.";
  } else {
    message += ` ${remainingLives} ${remainingLives === 1 ? "life" : "lives"} left.`;
  }

  return message;
}

function createLastTurn(base) {
  return {
    outcome: base.outcome,
    reason: base.reason || null,
    playerId: base.playerId,
    playerName: base.playerName || null,
    answer: base.answer || null,
    submittedAnswer: base.submittedAnswer || null,
    requiredLetter: base.requiredLetter || null,
    nextLetter: base.nextLetter || null,
    category: base.category || null,
    remainingLives: base.remainingLives ?? null,
    eliminated: Boolean(base.eliminated)
  };
}

export function createAtlasState({
  playerOrder,
  atlasData,
  category = ATLAS_CATEGORY_MIXED,
  matchMode = ATLAS_MATCH_MODE_LIVES,
  now = Date.now()
}) {
  if (!Array.isArray(playerOrder) || playerOrder.length < 2) {
    throw new AtlasRulesError("Atlas requires at least two players.");
  }
  if (!atlasData?.entries?.length || !atlasData?.lookup) {
    throw new AtlasRulesError("No Atlas dataset is available for the selected category.");
  }

  return {
    gameType: ATLAS_GAME,
    matchMode,
    matchModeLabel: ATLAS_MATCH_MODE_LABELS[matchMode] || "Lives",
    category,
    categoryLabel: ATLAS_CATEGORY_LABELS[category] || ATLAS_CATEGORY_LABELS[ATLAS_CATEGORY_MIXED],
    playerOrder,
    allowedEntries: atlasData.entries,
    allowedLookup: atlasData.lookup,
    allCategoryLookup: atlasData.globalLookup || atlasData.lookup,
    datasetSize: atlasData.entries.length,
    datasetSource: atlasData.source || "unknown",
    datasetDirectory: atlasData.directory || null,
    currentTurnIndex: 0,
    currentTurn: playerOrder[0],
    currentRound: 1,
    roundStartTime: now,
    roundTimeLimit: ATLAS_TURN_TIME_LIMIT_MS,
    roundLocked: false,
    previousAcceptedAnswer: null,
    previousAcceptedBy: null,
    requiredStartingLetter: null,
    usedAnswerKeys: new Set(),
    usedEntryIds: new Set(),
    usedAnswerCount: 0,
    totalValidAnswers: 0,
    playerScores: createCountMap(playerOrder, 0),
    playerLives: createCountMap(playerOrder, ATLAS_STARTING_LIVES),
    streaks: createCountMap(playerOrder, 0),
    longestStreaks: createCountMap(playerOrder, 0),
    eliminatedPlayers: [],
    recentAcceptedAnswers: [],
    lastTurn: null,
    lastMoveMessage: "Start anywhere. The first valid place sets the next letter.",
    gameOver: false,
    winner: null,
    draw: false,
    summaryText: ""
  };
}

function finishIfNeeded(nextState) {
  const activePlayers = activePlayerIds(nextState.playerOrder, nextState.eliminatedPlayers);
  if (activePlayers.length === 1) {
    return {
      ...nextState,
      currentTurn: activePlayers[0],
      gameOver: true,
      winner: activePlayers[0],
      draw: false,
      summaryText: `${nextState.totalValidAnswers} valid answer${nextState.totalValidAnswers === 1 ? "" : "s"} played.`
    };
  }
  if (activePlayers.length === 0) {
    return {
      ...nextState,
      gameOver: true,
      winner: null,
      draw: true,
      summaryText: `${nextState.totalValidAnswers} valid answer${nextState.totalValidAnswers === 1 ? "" : "s"} played.`
    };
  }
  return nextState;
}

function acceptTurn(state, { playerId, playerName, entry, submittedAnswer, now = Date.now() }) {
  const nextUsedAnswerKeys = new Set(state.usedAnswerKeys);
  for (const variant of entry.normalizedVariants) {
    nextUsedAnswerKeys.add(variant);
  }
  const nextUsedEntryIds = new Set(state.usedEntryIds);
  nextUsedEntryIds.add(entry.id);

  const nextScores = {
    ...state.playerScores,
    [playerId]: (state.playerScores[playerId] || 0) + 1
  };
  const nextStreaks = {
    ...state.streaks,
    [playerId]: (state.streaks[playerId] || 0) + 1
  };
  const nextLongestStreaks = {
    ...state.longestStreaks,
    [playerId]: Math.max(state.longestStreaks[playerId] || 0, nextStreaks[playerId])
  };

  const nextTurnIndex = nextActiveTurnIndex(state.playerOrder, state.currentTurnIndex, state.eliminatedPlayers);
  const nextTurn = state.playerOrder[nextTurnIndex];

  return {
    ...state,
    usedAnswerKeys: nextUsedAnswerKeys,
    usedEntryIds: nextUsedEntryIds,
    usedAnswerCount: state.usedAnswerCount + 1,
    totalValidAnswers: state.totalValidAnswers + 1,
    playerScores: nextScores,
    streaks: nextStreaks,
    longestStreaks: nextLongestStreaks,
    previousAcceptedAnswer: entry.name,
    previousAcceptedBy: playerId,
    requiredStartingLetter: entry.endingLetter,
    currentTurnIndex: nextTurnIndex,
    currentTurn: nextTurn,
    currentRound: state.currentRound + 1,
    roundStartTime: now,
    recentAcceptedAnswers: [
      {
        name: entry.name,
        playerId,
        playerName: playerName || null,
        category: entry.category,
        startingLetter: entry.startingLetter,
        endingLetter: entry.endingLetter
      },
      ...state.recentAcceptedAnswers
    ].slice(0, ATLAS_RECENT_ANSWERS_LIMIT),
    lastTurn: createLastTurn({
      outcome: "accepted",
      playerId,
      playerName,
      answer: entry.name,
      submittedAnswer,
      nextLetter: entry.endingLetter,
      category: entry.category
    }),
    lastMoveMessage: buildAcceptedMessage({
      playerName,
      answer: entry.name,
      nextLetter: entry.endingLetter
    }),
    gameOver: false,
    winner: null,
    draw: false,
    summaryText: ""
  };
}

function penalizeTurn(state, {
  playerId,
  playerName,
  reason,
  submittedAnswer = null,
  now = Date.now()
}) {
  const nextLives = {
    ...state.playerLives,
    [playerId]: Math.max(0, (state.playerLives[playerId] || 0) - 1)
  };
  const nextStreaks = {
    ...state.streaks,
    [playerId]: 0
  };
  const eliminated = nextLives[playerId] === 0 && !state.eliminatedPlayers.includes(playerId);
  const nextEliminatedPlayers = eliminated
    ? [...state.eliminatedPlayers, playerId]
    : [...state.eliminatedPlayers];
  const nextTurnIndex = nextActiveTurnIndex(state.playerOrder, state.currentTurnIndex, nextEliminatedPlayers);
  const nextTurn = state.playerOrder[nextTurnIndex];

  const nextState = finishIfNeeded({
    ...state,
    playerLives: nextLives,
    streaks: nextStreaks,
    eliminatedPlayers: nextEliminatedPlayers,
    currentTurnIndex: nextTurnIndex,
    currentTurn: nextTurn,
    currentRound: state.currentRound + 1,
    roundStartTime: now,
    lastTurn: createLastTurn({
      outcome: reasonToOutcome(reason),
      reason,
      playerId,
      playerName,
      submittedAnswer,
      requiredLetter: state.requiredStartingLetter,
      remainingLives: nextLives[playerId],
      eliminated
    }),
    lastMoveMessage: buildPenaltyMessage({
      reason,
      playerName,
      requiredLetter: state.requiredStartingLetter,
      remainingLives: nextLives[playerId],
      eliminated,
      categoryLabel: state.categoryLabel
    })
  });

  return nextState.gameOver
    ? {
      ...nextState,
      summaryText: `${nextState.totalValidAnswers} valid answer${nextState.totalValidAnswers === 1 ? "" : "s"} played.`
    }
    : nextState;
}

export function submitAtlasAnswer(state, { playerId, playerName, answer, now = Date.now() }) {
  const validation = validateAtlasAnswer(state, { playerId, answer });
  if (!validation.ok) {
    if (validation.fatal) {
      throw new AtlasRulesError(validation.message);
    }

    return {
      state: penalizeTurn(state, {
        playerId,
        playerName,
        reason: validation.reason,
        submittedAnswer: validation.submittedAnswer,
        now
      }),
      changed: true,
      accepted: false,
      reason: validation.reason,
      message: validation.message
    };
  }

  return {
    state: acceptTurn(state, {
      playerId,
      playerName,
      entry: validation.entry,
      submittedAnswer: validation.submittedAnswer,
      now
    }),
    changed: true,
    accepted: true,
    reason: null,
    message: validation.message
  };
}

export function expireAtlasTurn(state, { now = Date.now(), playerName } = {}) {
  if (state.gameOver || now - state.roundStartTime < state.roundTimeLimit) {
    return { state, changed: false };
  }
  return {
    state: penalizeTurn(state, {
      playerId: state.currentTurn,
      playerName,
      reason: ATLAS_VALIDATION_REASON_TIMEOUT,
      now
    }),
    changed: true,
    accepted: false,
    reason: ATLAS_VALIDATION_REASON_TIMEOUT,
    message: `${playerLabel(playerName)} timed out.`
  };
}

export function publicAtlasState(state) {
  const {
    allowedEntries,
    allowedLookup,
    allCategoryLookup,
    usedAnswerKeys,
    usedEntryIds,
    playerOrder,
    ...publicState
  } = state;
  return { ...publicState };
}
