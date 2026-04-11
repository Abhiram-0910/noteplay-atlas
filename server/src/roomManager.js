import { config } from "./config.js";
import { GameRulesError, normalizeMode } from "./games/sos/gameLogic.js";
import { applySosMove, createSosState, publicSosState, SOS_GAME } from "./games/sos/state.js";
import {
  advanceQuestionRound,
  BRAIN_GAME,
  createQuestionState,
  expireQuestionRound,
  publicQuestionState,
  QuestionRulesError,
  submitQuestionAnswer,
  useQuestionHint
} from "./games/brain/gameLogic.js";
import { atlasCategoryView, createAtlasDataset, loadAtlasDataset, normalizeAtlasCategory } from "./games/atlas/datasetAdapter.js";
import { ATLAS_GAME, AtlasRulesError, createAtlasState, expireAtlasTurn, publicAtlasState, submitAtlasAnswer } from "./games/atlas/gameLogic.js";
import { loadQuestionGameQuestions } from "./games/brain/datasetAdapter.js";
import { drawRandomQuestionSet } from "./shared/randomizer.js";
import { cleanPlayerName, generateId, generateRoomCode, normalizeRoomCode, nowIso } from "./utils.js";
import { projectConfig } from "../../project.config.js";

export const GAME_TYPES = new Set([SOS_GAME, BRAIN_GAME, ATLAS_GAME]);
const PROJECT_GAME = projectConfig.gameId;

const GAME_LABELS = {
  [SOS_GAME]: "SOS",
  [BRAIN_GAME]: "Brain Battle",
  [ATLAS_GAME]: "Atlas"
};

export class RoomError extends Error {
  constructor(message) {
    super(message);
    this.name = "RoomError";
  }
}

function normalizeGameType(selectedGame) {
  const normalized = String(selectedGame || PROJECT_GAME).trim().toLowerCase();
  if (["riddle", "math", "mathematical", "aots", "aptitude", "quiz", "brain", "brain battle", "brain-battle", "brainbattle", "question"].includes(normalized)) {
    if (PROJECT_GAME !== BRAIN_GAME) {
      throw new RoomError(`${GAME_LABELS[PROJECT_GAME]} runs in this project. Start ${GAME_LABELS[BRAIN_GAME]} from its own game folder.`);
    }
    return PROJECT_GAME;
  }
  if (["atlas", "geography", "geo", "word chain", "word-chain"].includes(normalized)) {
    if (PROJECT_GAME !== ATLAS_GAME) {
      throw new RoomError(`${GAME_LABELS[PROJECT_GAME]} runs in this project. Start ${GAME_LABELS[ATLAS_GAME]} from its own game folder.`);
    }
    return PROJECT_GAME;
  }
  if (!GAME_TYPES.has(normalized)) {
    throw new RoomError("Invalid game selection.");
  }
  if (normalized !== PROJECT_GAME) {
    throw new RoomError(`${GAME_LABELS[PROJECT_GAME]} runs in this project. Start ${GAME_LABELS[normalized]} from its own game folder.`);
  }
  return PROJECT_GAME;
}

function defaultGameSettings() {
  return {
    sosMode: "general",
    atlasCategory: "mixed",
    atlasMode: "lives"
  };
}

function normalizeGameSettings({ settings = {}, mode, atlasCategory } = {}, fallback = defaultGameSettings()) {
  return {
    sosMode: normalizeMode(settings.sosMode || settings.mode || mode || fallback.sosMode),
    atlasCategory: normalizeAtlasCategory(settings.atlasCategory || atlasCategory || fallback.atlasCategory),
    atlasMode: "lives"
  };
}

export class RoomManager {
  constructor(options = {}) {
    this.rooms = new Map();
    this.socketToPlayer = new Map();
    this.roomCodeLength = options.roomCodeLength || config.roomCodeLength;
    this.roomTtlMs = options.roomTtlMs || config.roomTtlMs;
    this.chatMaxLength = options.chatMaxLength || config.chatMaxLength;
    this.chatCooldownMs = options.chatCooldownMs ?? config.chatCooldownMs;
    this.questionRounds = options.questionRounds || options.riddleRounds || options.mathRounds || 5;
    this.questionDataset = options.questionQuestions
      ? { questions: options.questionQuestions, source: "injected" }
      : loadQuestionGameQuestions({
        datasetOptions: options.datasetOptions || {},
        riddleQuestions: options.riddleQuestions,
        mathQuestions: options.mathQuestions || options.aotsQuestions
      });
    this.atlasDataset = options.atlasDataset
      ? options.atlasDataset
      : options.atlasEntries
        ? createAtlasDataset(options.atlasEntries, "injected")
        : loadAtlasDataset(options.atlasDatasetOptions || options.datasetOptions || {});
    this.rng = options.rng || Math.random;
    this.questionRecentIds = [];
    this.questionRecentBufferLimit = options.questionRecentBufferLimit || Math.min(Math.max(this.questionRounds * 10, 50), 300);
  }

  createRoom({ socketId, playerName, mode = "general", playerId, selectedGame = PROJECT_GAME, settings, atlasCategory }) {
    this.detachSocket(socketId);
    const roomCode = this.#newRoomCode();
    const cleanedName = cleanPlayerName(playerName);
    const id = playerId || generateId();
    const player = this.#createPlayer({ socketId, playerId: id, playerName: cleanedName });
    const gameType = normalizeGameType(selectedGame);
    const gameSettings = normalizeGameSettings({ settings, mode, atlasCategory });
    const createdAt = nowIso();
    const room = {
      roomCode,
      hostPlayerId: id,
      selectedGame: gameType,
      gameSettings,
      mode: gameSettings.sosMode,
      atlasCategory: gameSettings.atlasCategory,
      atlasMode: gameSettings.atlasMode,
      players: new Map([[id, player]]),
      readyStates: { [id]: false },
      chatMessages: [],
      currentGameState: null,
      gameStarted: false,
      gameOver: false,
      winner: null,
      draw: false,
      createdAt,
      roomCreatedAt: createdAt,
      lastActivity: Date.now(),
      rematchVotes: new Set(),
      rematchStatus: "idle",
      lastChatAtByPlayer: new Map(),
      questionQueueState: {
        remainingQuestions: [],
        lastQuestionId: null,
        lastQuestionType: null,
        lastQuestionCategory: null,
        lastQuestionDifficulty: null
      }
    };

    this.rooms.set(roomCode, room);
    this.socketToPlayer.set(socketId, { roomCode, playerId: id });
    return { room, player, reconnected: false };
  }

  joinRoom({ socketId, roomCode, playerName, playerId }) {
    const room = this.#getRoom(roomCode);
    this.detachSocket(socketId);
    const cleanedName = cleanPlayerName(playerName);
    let player;
    let reconnected = false;

    if (playerId && room.players.has(playerId)) {
      player = room.players.get(playerId);
      if (player.socketId && player.socketId !== socketId) {
        this.socketToPlayer.delete(player.socketId);
      }
      reconnected = !player.connected;
      player.socketId = socketId;
      player.playerName = cleanedName || player.playerName;
      player.connected = true;
      player.lastSeen = Date.now();
    } else {
      if (room.players.size >= 2) {
        throw new RoomError("This room already has two players.");
      }
      const id = playerId || generateId();
      player = this.#createPlayer({ socketId, playerId: id, playerName: cleanedName });
      room.players.set(id, player);
      room.readyStates[id] = false;
    }

    this.socketToPlayer.set(socketId, { roomCode: room.roomCode, playerId: player.playerId });
    this.#touch(room);
    return { room, player, reconnected };
  }

  selectGame({ socketId, roomCode, playerId, selectedGame, mode, settings, atlasCategory }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureHost(room, playerId);
    if (room.gameStarted && !room.gameOver) {
      throw new RoomError("Return to the lobby before changing games.");
    }
    room.selectedGame = normalizeGameType(selectedGame);
    room.gameSettings = normalizeGameSettings({ settings, mode, atlasCategory }, room.gameSettings);
    room.mode = room.gameSettings.sosMode;
    room.atlasCategory = room.gameSettings.atlasCategory;
    room.atlasMode = room.gameSettings.atlasMode;
    room.currentGameState = null;
    room.gameStarted = false;
    room.gameOver = false;
    room.winner = null;
    room.draw = false;
    room.rematchVotes.clear();
    room.rematchStatus = "idle";
    this.#resetReady(room);
    this.#touch(room);
    return room;
  }

  setReady({ socketId, roomCode, playerId, ready }) {
    const { room, player } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    if (room.gameStarted && !room.gameOver) {
      throw new RoomError("The game is already in progress.");
    }
    player.ready = Boolean(ready);
    room.readyStates[player.playerId] = player.ready;
    room.rematchStatus = "idle";
    this.#touch(room);
    return room;
  }

  toggleReady({ socketId, roomCode, playerId }) {
    const { room, player } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    return this.setReady({ socketId, roomCode: room.roomCode, playerId: player.playerId, ready: !player.ready });
  }

  startSelectedGame({ socketId, roomCode, playerId }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureHost(room, playerId);
    this.#ensureCanStart(room);
    const playerOrder = this.#playerOrder(room);
    room.currentGameState = this.#createGameState(room, playerOrder);
    room.gameStarted = true;
    room.gameOver = false;
    room.winner = null;
    room.draw = false;
    room.rematchVotes.clear();
    room.rematchStatus = "idle";
    this.#syncPlayerScores(room);
    this.#touch(room);
    return room;
  }

  startGame(payload) {
    return this.startSelectedGame(payload);
  }

  makeMove({ socketId, roomCode, playerId, row, col, letter }) {
    const { room, player } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureActiveGame(room, SOS_GAME);
    try {
      room.currentGameState = applySosMove(room.currentGameState, {
        row,
        col,
        letter,
        playerId,
        playerOrder: this.#playerOrder(room),
        playerName: player.playerName
      });
      this.#syncRoomResult(room);
      this.#syncPlayerScores(room);
      room.rematchVotes.clear();
      room.rematchStatus = "idle";
      this.#touch(room);
      return room;
    } catch (error) {
      if (error instanceof GameRulesError) {
        throw new RoomError(error.message);
      }
      throw error;
    }
  }

  submitQuestionAnswer({ socketId, roomCode, playerId, answer, now }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureActiveGame(room, BRAIN_GAME);
    try {
      const result = submitQuestionAnswer(room.currentGameState, { playerId, answer, now });
      room.currentGameState = result.state;
      this.#syncRoomResult(room);
      this.#syncPlayerScores(room);
      this.#touch(room);
      return { room, ...result };
    } catch (error) {
      if (error instanceof QuestionRulesError) {
        throw new RoomError(error.message);
      }
      throw error;
    }
  }

  submitAtlasAnswer({ socketId, roomCode, playerId, answer, now }) {
    const { room, player } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureActiveGame(room, ATLAS_GAME);
    try {
      const result = submitAtlasAnswer(room.currentGameState, {
        playerId,
        playerName: player.playerName,
        answer,
        now
      });
      room.currentGameState = result.state;
      this.#syncRoomResult(room);
      this.#syncPlayerScores(room);
      this.#touch(room);
      return { room, ...result };
    } catch (error) {
      if (error instanceof AtlasRulesError) {
        throw new RoomError(error.message);
      }
      throw error;
    }
  }

  useQuestionHint({ socketId, roomCode, playerId }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureActiveGame(room, BRAIN_GAME);
    try {
      const result = useQuestionHint(room.currentGameState);
      room.currentGameState = result.state;
      this.#touch(room);
      return { room, ...result };
    } catch (error) {
      if (error instanceof QuestionRulesError) {
        throw new RoomError(error.message);
      }
      throw error;
    }
  }

  nextRoundRequest({ socketId, roomCode, playerId, now = Date.now() }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    if (room.selectedGame !== BRAIN_GAME) {
      throw new RoomError("This game does not use rounds.");
    }
    if (!room.currentGameState?.roundLocked || room.gameOver) {
      throw new RoomError("Next round is not available yet.");
    }
    const advanced = this.#advanceTimedRound(room, now, true);
    if (!advanced.changed) {
      throw new RoomError("Next round is not available yet.");
    }
    this.#touch(room);
    return { room, ...advanced };
  }

  tickTimedGame(roomCode, now = Date.now()) {
    const room = this.#getRoom(roomCode);
    if (!room.gameStarted || room.gameOver || !this.#isTimedGame(room.selectedGame)) {
      return { room, changed: false, event: null };
    }

    if (room.selectedGame === ATLAS_GAME) {
      const expired = this.#expireAtlasTurn(room, now);
      if (expired.changed) {
        this.#syncRoomResult(room);
        this.#syncPlayerScores(room);
        this.#touch(room);
        return { room, ...expired };
      }
      return { room, changed: false, event: null };
    }

    const advanced = this.#advanceTimedRound(room, now, false);
    if (advanced.changed) {
      this.#touch(room);
      return { room, ...advanced };
    }

    const expired = this.#expireTimedRound(room, now);
    if (expired.changed) {
      this.#syncRoomResult(room);
      this.#syncPlayerScores(room);
      this.#touch(room);
      return { room, ...expired };
    }

    return { room, changed: false, event: null };
  }

  backToLobby({ socketId, roomCode, playerId }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    this.#ensureHost(room, playerId);
    room.currentGameState = null;
    room.gameStarted = false;
    room.gameOver = false;
    room.winner = null;
    room.draw = false;
    room.rematchVotes.clear();
    room.rematchStatus = "idle";
    this.#resetReady(room);
    this.#touch(room);
    return room;
  }

  requestRematch({ socketId, roomCode, playerId }) {
    const { room } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    if (!room.gameOver) {
      throw new RoomError("Play again is available after the game ends.");
    }
    room.rematchVotes.add(playerId);
    room.rematchStatus = room.rematchVotes.size === room.players.size ? "accepted" : "requested";
    this.#touch(room);
    return { room, restarted: false };
  }

  acceptRematch({ socketId, roomCode, playerId }) {
    const result = this.requestRematch({ socketId, roomCode, playerId });
    if (result.room.players.size === 2 && result.room.rematchVotes.size === 2) {
      result.room.currentGameState = this.#createGameState(result.room, this.#playerOrder(result.room));
      result.room.gameStarted = true;
      result.room.gameOver = false;
      result.room.winner = null;
      result.room.draw = false;
      result.room.rematchVotes.clear();
      result.room.rematchStatus = "started";
      for (const player of result.room.players.values()) {
        player.ready = true;
        result.room.readyStates[player.playerId] = true;
      }
      this.#syncPlayerScores(result.room);
      this.#touch(result.room);
      return { room: result.room, restarted: true };
    }
    return result;
  }

  leaveRoom({ socketId, roomCode, playerId }) {
    const mapping = this.socketToPlayer.get(socketId) || (roomCode && playerId ? { roomCode: normalizeRoomCode(roomCode), playerId } : null);
    if (!mapping) {
      return null;
    }
    const room = this.rooms.get(mapping.roomCode);
    this.socketToPlayer.delete(socketId);
    if (!room || !room.players.has(mapping.playerId)) {
      return null;
    }
    const player = room.players.get(mapping.playerId);
    if (player.socketId === socketId) {
      player.socketId = null;
    }
    player.connected = false;
    player.ready = false;
    player.lastSeen = Date.now();
    room.readyStates[player.playerId] = false;
    this.#touch(room);
    return { room, player };
  }

  detachSocket(socketId) {
    return this.leaveRoom({ socketId });
  }

  sendChatMessage({ socketId, roomCode, playerId, text }) {
    const { room, player } = this.#requireSocketPlayer(socketId, roomCode, playerId);
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      throw new RoomError("Chat message cannot be empty.");
    }
    if (trimmed.length > this.chatMaxLength) {
      throw new RoomError(`Chat message must be ${this.chatMaxLength} characters or fewer.`);
    }
    const now = Date.now();
    const lastChatAt = room.lastChatAtByPlayer.get(playerId) || 0;
    if (now - lastChatAt < this.chatCooldownMs) {
      throw new RoomError("Please wait before sending another message.");
    }
    room.lastChatAtByPlayer.set(playerId, now);

    const message = {
      messageId: generateId(),
      roomCode: room.roomCode,
      senderPlayerId: playerId,
      senderName: player.playerName,
      text: trimmed,
      timestamp: new Date(now).toISOString()
    };
    room.chatMessages.push(message);
    this.#touch(room);
    return { room, message };
  }

  getRoom(roomCode) {
    return this.#getRoom(roomCode);
  }

  getPlayerRoom(socketId) {
    const mapping = this.socketToPlayer.get(socketId);
    if (!mapping) {
      return null;
    }
    const room = this.rooms.get(mapping.roomCode);
    const player = room?.players.get(mapping.playerId);
    return room && player ? { room, player } : null;
  }

  cleanupAbandonedRooms() {
    const now = Date.now();
    const removed = [];
    for (const [roomCode, room] of this.rooms.entries()) {
      const allDisconnected = room.players.size > 0 && [...room.players.values()].every((player) => !player.connected);
      if (allDisconnected && now - room.lastActivity > this.roomTtlMs) {
        for (const player of room.players.values()) {
          if (player.socketId) {
            this.socketToPlayer.delete(player.socketId);
          }
        }
        this.rooms.delete(roomCode);
        removed.push(roomCode);
      }
    }
    return removed;
  }

  getActiveTimedRooms() {
    return [...this.rooms.values()].filter((room) => room.gameStarted && !room.gameOver && this.#isTimedGame(room.selectedGame));
  }

  publicState(room) {
    const currentGameState = this.#publicGameState(room);
    const playerScores = currentGameState?.playerScores || {};
    const players = [...room.players.values()].map((player) => ({
      playerId: player.playerId,
      name: player.playerName,
      playerName: player.playerName,
      connected: player.connected,
      score: playerScores[player.playerId] ?? player.score,
      ready: player.ready,
      lastSeen: player.lastSeen
    }));

    return {
      roomCode: room.roomCode,
      hostPlayerId: room.hostPlayerId,
      selectedGame: room.selectedGame,
      selectedGameLabel: GAME_LABELS[room.selectedGame],
      mode: room.mode,
      atlasCategory: room.atlasCategory,
      atlasMode: room.atlasMode,
      gameSettings: { ...room.gameSettings },
      players,
      scores: { ...playerScores },
      readyStates: { ...room.readyStates },
      chatMessages: [...room.chatMessages],
      currentGameState,
      gameStarted: room.gameStarted,
      gameOver: room.gameOver,
      winner: room.winner,
      winnerName: room.winner ? this.#playerName(room, room.winner) : null,
      draw: room.draw,
      createdAt: room.createdAt,
      roomCreatedAt: room.roomCreatedAt || room.createdAt,
      rematchVotes: [...room.rematchVotes],
      rematchStatus: room.rematchStatus,
      board: currentGameState?.board || null,
      currentTurn: currentGameState?.currentTurn || null,
      lastMove: currentGameState?.lastMove || null,
      latestSosLines: currentGameState?.latestSosLines || [],
      lastMoveMessage: currentGameState?.lastMoveMessage || currentGameState?.roundResultMessage || "",
      boardSize: 8
    };
  }

  roomCount() {
    return this.rooms.size;
  }

  #createPlayer({ socketId, playerId, playerName }) {
    return {
      socketId,
      playerId,
      playerName,
      connected: true,
      score: 0,
      ready: false,
      joinedAt: Date.now(),
      lastSeen: Date.now()
    };
  }

  #newRoomCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const code = generateRoomCode(this.roomCodeLength);
      if (!this.rooms.has(code)) {
        return code;
      }
    }
    throw new RoomError("Could not generate a unique room code.");
  }

  #ensureCanStart(room) {
    if (room.players.size !== 2) {
      throw new RoomError("Waiting for another player.");
    }
    const players = [...room.players.values()];
    if (!players.every((player) => player.connected)) {
      throw new RoomError("Both players must be connected before starting.");
    }
    const guests = players.filter((player) => player.playerId !== room.hostPlayerId);
    if (!guests.every((player) => player.ready)) {
      throw new RoomError("The joined player must be ready before starting.");
    }
  }

  #ensureHost(room, playerId) {
    if (room.hostPlayerId !== playerId) {
      throw new RoomError("Only the room host can do that.");
    }
  }

  #ensureActiveGame(room, expectedGame) {
    if (!room.gameStarted) {
      throw new RoomError("The game has not started.");
    }
    if (room.selectedGame !== expectedGame) {
      throw new RoomError(`The selected game is ${GAME_LABELS[room.selectedGame]}.`);
    }
    if (room.players.size !== 2) {
      throw new RoomError("Exactly two players are required.");
    }
  }

  #createGameState(room, playerOrder) {
    if (room.selectedGame === SOS_GAME) {
      return createSosState({ playerOrder, mode: room.gameSettings.sosMode });
    }
    if (room.selectedGame === BRAIN_GAME) {
      const selection = drawRandomQuestionSet(
        this.questionDataset.questions,
        this.questionRounds,
        room.questionQueueState,
        this.rng,
        this.questionRecentIds
      );
      room.questionQueueState = selection.queueState;
      this.questionRecentIds = [...this.questionRecentIds, ...selection.questions.map((question) => question.id)]
        .slice(-this.questionRecentBufferLimit);
      return createQuestionState({
        playerOrder,
        totalRounds: this.questionRounds,
        selectedQuestions: selection.questions
      });
    }
    if (room.selectedGame === ATLAS_GAME) {
      return createAtlasState({
        playerOrder,
        atlasData: atlasCategoryView(this.atlasDataset, room.gameSettings.atlasCategory),
        category: room.gameSettings.atlasCategory,
        matchMode: room.gameSettings.atlasMode
      });
    }
    throw new RoomError("Invalid game selection.");
  }

  #publicGameState(room) {
    if (!room.currentGameState) {
      return null;
    }
    if (room.selectedGame === SOS_GAME) {
      return publicSosState(room.currentGameState);
    }
    if (room.selectedGame === BRAIN_GAME) {
      return publicQuestionState(room.currentGameState);
    }
    if (room.selectedGame === ATLAS_GAME) {
      return publicAtlasState(room.currentGameState);
    }
    return null;
  }

  #syncRoomResult(room) {
    const state = room.currentGameState;
    if (!state) {
      return;
    }
    room.gameOver = Boolean(state.gameOver);
    room.winner = state.winner || state.matchWinner || null;
    room.draw = Boolean(state.draw);
  }

  #syncPlayerScores(room) {
    const scores = room.currentGameState?.playerScores || {};
    for (const [playerId, score] of Object.entries(scores)) {
      const player = room.players.get(playerId);
      if (player) {
        player.score = score;
      }
    }
  }

  #expireTimedRound(room, now) {
    const result = expireQuestionRound(room.currentGameState, now);
    room.currentGameState = result.state;
    return { changed: result.changed, event: result.changed ? (room.currentGameState.gameOver ? "match_result" : "round_result") : null };
  }

  #expireAtlasTurn(room, now) {
    const currentPlayerId = room.currentGameState?.currentTurn;
    const currentPlayerName = currentPlayerId ? this.#playerName(room, currentPlayerId) : null;
    const result = expireAtlasTurn(room.currentGameState, {
      now,
      playerName: currentPlayerName
    });
    room.currentGameState = result.state;
    return { changed: result.changed, event: result.changed ? "game_updated" : null };
  }

  #advanceTimedRound(room, now, force) {
    let state = room.currentGameState;
    if (force && state?.roundLocked && state?.nextRoundAt) {
      state = { ...state, nextRoundAt: now };
    }
    const result = advanceQuestionRound(state, now);
    room.currentGameState = result.state;
    return { changed: result.changed, event: result.changed ? "round_started" : null };
  }

  #isTimedGame(gameType) {
    return gameType === BRAIN_GAME || gameType === ATLAS_GAME;
  }

  #resetReady(room) {
    for (const player of room.players.values()) {
      player.ready = false;
      room.readyStates[player.playerId] = false;
    }
  }

  #requireSocketPlayer(socketId, roomCode, playerId) {
    const room = this.#getRoom(roomCode);
    const mapping = this.socketToPlayer.get(socketId);
    if (!mapping || mapping.roomCode !== room.roomCode || mapping.playerId !== playerId) {
      throw new RoomError("Socket session does not match this player.");
    }
    const player = room.players.get(playerId);
    if (!player) {
      throw new RoomError("Player is not in this room.");
    }
    return { room, player };
  }

  #getRoom(roomCode) {
    const normalized = normalizeRoomCode(roomCode);
    if (!normalized) {
      throw new RoomError("Room code is required.");
    }
    const room = this.rooms.get(normalized);
    if (!room) {
      throw new RoomError("Room not found.");
    }
    return room;
  }

  #playerOrder(room) {
    return [...room.players.keys()];
  }

  #playerName(room, playerId) {
    return room.players.get(playerId)?.playerName || "Player";
  }

  #touch(room) {
    room.lastActivity = Date.now();
  }
}
