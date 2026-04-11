import { buildRandomQuestionSet } from "../../shared/randomizer.js";
import { loadQuestionGameQuestions } from "./datasetAdapter.js";

export const BRAIN_GAME = "brain";
export const QUESTION_GAME = BRAIN_GAME;
export const DEFAULT_QUESTION_ROUNDS = 5;
export const QUESTION_TIME_LIMIT_MS = 75_000;
export const ROUND_ADVANCE_DELAY_MS = 4_000;

const DEFAULT_QUESTIONS = loadQuestionGameQuestions().questions;

export class QuestionRulesError extends Error {
  constructor(message) {
    super(message);
    this.name = "QuestionRulesError";
  }
}

export function normalizeQuestionAnswer(answer) {
  const text = String(answer ?? "").trim().toLowerCase();
  if (!text) {
    throw new QuestionRulesError("Answer cannot be empty.");
  }
  return text.replace(/\s+/g, " ");
}

function compactAnswer(answer) {
  return normalizeQuestionAnswer(answer).replace(/[^a-z0-9./-]/g, "");
}

function comparableNumber(answer) {
  const text = compactAnswer(answer);
  const fraction = text.match(/^(-?\d+)\/(-?\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return Number(text);
  }
  return null;
}

export function answersMatch(answer, expectedAnswer) {
  const normalizedAnswer = compactAnswer(answer);
  const normalizedExpected = compactAnswer(expectedAnswer);
  if (normalizedAnswer === normalizedExpected) {
    return true;
  }

  const answerNumber = comparableNumber(normalizedAnswer);
  const expectedNumber = comparableNumber(normalizedExpected);
  return answerNumber !== null &&
    expectedNumber !== null &&
    Math.abs(answerNumber - expectedNumber) < Number.EPSILON * 100;
}

function publicQuestion(question, hintRevealed = false) {
  return {
    id: question.id,
    question: question.question,
    type: question.type || "question",
    hint: hintRevealed ? question.hint || null : null,
    hasHint: Boolean(question.hint),
    difficulty: question.difficulty || null,
    category: question.category || null,
    imageUrl: question.imageUrl || null,
    imageDescription: question.imageDescription || null
  };
}

function decideMatch(playerScores) {
  const entries = Object.entries(playerScores);
  const highest = Math.max(...entries.map(([, score]) => score));
  const leaders = entries.filter(([, score]) => score === highest).map(([playerId]) => playerId);
  return leaders.length === 1 ? { matchWinner: leaders[0], draw: false } : { matchWinner: null, draw: true };
}

export function createQuestionState({
  playerOrder,
  totalRounds = DEFAULT_QUESTION_ROUNDS,
  now = Date.now(),
  questions = DEFAULT_QUESTIONS,
  selectedQuestions,
  rng = Math.random
}) {
  const questionsForMatch = selectedQuestions || buildRandomQuestionSet(questions, totalRounds, rng);
  const firstQuestion = questionsForMatch[0];
  return {
    gameType: BRAIN_GAME,
    currentRound: 1,
    totalRounds,
    questions: questionsForMatch,
    usedQuestionIds: questionsForMatch.map((question) => question.id),
    currentQuestion: publicQuestion(firstQuestion, false),
    currentAnswer: firstQuestion.answer,
    roundStartTime: now,
    roundTimeLimit: QUESTION_TIME_LIMIT_MS,
    roundWinner: null,
    playerScores: Object.fromEntries(playerOrder.map((playerId) => [playerId, 0])),
    streaks: Object.fromEntries(playerOrder.map((playerId) => [playerId, 0])),
    lastRoundPoints: 0,
    lastRoundBasePoints: 0,
    lastRoundSpeedBonus: 0,
    lastRoundStreakBonus: 0,
    hintRevealed: false,
    hintPenalty: 0,
    revealedAnswer: null,
    roundLocked: false,
    matchWinner: null,
    draw: false,
    gameOver: false,
    roundResultMessage: "",
    nextRoundAt: null
  };
}

function lockRound(state, { winner = null, now = Date.now() }) {
  const nextScores = { ...state.playerScores };
  const nextStreaks = { ...state.streaks };
  let basePoints = 0;
  let speedBonus = 0;
  let streakBonus = 0;
  let pointsEarned = 0;

  if (winner) {
    basePoints = state.hintRevealed ? 7 : 10;
    const remainingMs = Math.max(0, state.roundStartTime + state.roundTimeLimit - now);
    speedBonus = Math.ceil((remainingMs / state.roundTimeLimit) * 5);
    const nextStreak = (nextStreaks[winner] || 0) + 1;
    streakBonus = nextStreak >= 2 ? 2 : 0;
    pointsEarned = basePoints + speedBonus + streakBonus;
    for (const playerId of Object.keys(nextStreaks)) {
      nextStreaks[playerId] = playerId === winner ? nextStreak : 0;
    }
    nextScores[winner] += pointsEarned;
  } else {
    for (const playerId of Object.keys(nextStreaks)) {
      nextStreaks[playerId] = 0;
    }
  }

  const finalRound = state.currentRound >= state.totalRounds;
  const match = finalRound ? decideMatch(nextScores) : { matchWinner: null, draw: false };

  return {
    ...state,
    playerScores: nextScores,
    streaks: nextStreaks,
    roundWinner: winner,
    revealedAnswer: state.currentAnswer,
    roundLocked: true,
    matchWinner: match.matchWinner,
    draw: match.draw,
    gameOver: finalRound,
    lastRoundPoints: pointsEarned,
    lastRoundBasePoints: basePoints,
    lastRoundSpeedBonus: speedBonus,
    lastRoundStreakBonus: streakBonus,
    roundResultMessage: winner
      ? `Correct answer. ${pointsEarned} point${pointsEarned === 1 ? "" : "s"} earned.`
      : "Time is up. No round winner.",
    nextRoundAt: finalRound ? null : now + ROUND_ADVANCE_DELAY_MS
  };
}

export function useQuestionHint(state) {
  if (state.gameOver) {
    throw new QuestionRulesError("The match is already over.");
  }
  if (state.roundLocked) {
    throw new QuestionRulesError("This round is already locked.");
  }
  const question = state.questions[state.currentRound - 1];
  if (!question?.hint) {
    throw new QuestionRulesError("No hint is available for this question.");
  }
  if (state.hintRevealed) {
    return { state, changed: false, message: "Hint already revealed." };
  }
  return {
    state: {
      ...state,
      hintRevealed: true,
      hintPenalty: 1,
      currentQuestion: publicQuestion(question, true)
    },
    changed: true,
    message: "Hint revealed. This round is now worth fewer base points."
  };
}

export function submitQuestionAnswer(state, { playerId, answer, now = Date.now() }) {
  if (state.gameOver) {
    throw new QuestionRulesError("The match is already over.");
  }
  if (state.roundLocked) {
    throw new QuestionRulesError("This round is already locked.");
  }

  normalizeQuestionAnswer(answer);
  if (!answersMatch(answer, state.currentAnswer)) {
    return { state, correct: false, changed: false, message: "Not correct yet." };
  }

  return {
    state: lockRound(state, { winner: playerId, now }),
    correct: true,
    changed: true,
    message: "Correct answer."
  };
}

export function expireQuestionRound(state, now = Date.now()) {
  if (state.gameOver || state.roundLocked || now - state.roundStartTime < state.roundTimeLimit) {
    return { state, changed: false };
  }
  return { state: lockRound(state, { now }), changed: true };
}

export function advanceQuestionRound(state, now = Date.now()) {
  if (state.gameOver || !state.roundLocked || !state.nextRoundAt || now < state.nextRoundAt) {
    return { state, changed: false };
  }
  const nextRound = state.currentRound + 1;
  const question = state.questions[nextRound - 1];
  return {
    state: {
      ...state,
      currentRound: nextRound,
      currentQuestion: publicQuestion(question, false),
      currentAnswer: question.answer,
      roundStartTime: now,
      roundWinner: null,
      revealedAnswer: null,
      roundLocked: false,
      lastRoundPoints: 0,
      lastRoundBasePoints: 0,
      lastRoundSpeedBonus: 0,
      lastRoundStreakBonus: 0,
      hintRevealed: false,
      hintPenalty: 0,
      roundResultMessage: "",
      nextRoundAt: null
    },
    changed: true
  };
}

export function publicQuestionState(state) {
  const { questions, currentAnswer, ...publicState } = state;
  return { ...publicState };
}
