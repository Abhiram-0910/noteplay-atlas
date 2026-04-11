import { Server } from "socket.io";
import { config } from "./config.js";
import { RoomError, RoomManager } from "./roomManager.js";

export const roomManager = new RoomManager({
  atlasDatasetOptions: {
    dataDir: config.atlasDatasetDir || undefined
  }
});

function payloadError(data) {
  return data && typeof data === "object" ? data : {};
}

function emitInvalid(socket, message) {
  socket.emit("invalid_action", { message });
  socket.emit("error_message", { message });
}

async function emitRoomState(io, room) {
  const state = roomManager.publicState(room);
  io.to(room.roomCode).emit("room_updated", state);
  io.to(room.roomCode).emit("game_state_updated", state);
}

async function leavePreviousSocketRoom(socket) {
  const existing = roomManager.getPlayerRoom(socket.id);
  if (!existing) {
    return null;
  }
  socket.leave(existing.room.roomCode);
  return existing.room;
}

async function notifyPreviousRoom(io, previousRoom, nextRoomCode) {
  if (!previousRoom || previousRoom.roomCode === nextRoomCode) {
    return;
  }
  io.to(previousRoom.roomCode).emit("player_disconnected", {
    roomCode: previousRoom.roomCode,
    playerId: previousRoom.players ? null : undefined,
    message: "A player left the room."
  });
  await emitRoomState(io, previousRoom);
}

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin === "*" ? "*" : config.clientOrigin.split(",").map((origin) => origin.trim()),
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    socket.emit("connected", { socketId: socket.id });

    socket.on("create_room", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const previousRoom = await leavePreviousSocketRoom(socket);
        const { room, player } = roomManager.createRoom({
          socketId: socket.id,
          playerName: data.playerName,
          mode: data.mode,
          atlasCategory: data.atlasCategory,
          settings: data.settings,
          selectedGame: data.selectedGame,
          playerId: data.playerId
        });
        socket.join(room.roomCode);
        await notifyPreviousRoom(io, previousRoom, room.roomCode);
        socket.emit("room_created", {
          roomCode: room.roomCode,
          playerId: player.playerId,
          state: roomManager.publicState(room)
        });
        socket.emit("chat_history", { roomCode: room.roomCode, messages: room.chatMessages });
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("select_game", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const room = roomManager.selectGame({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId,
          selectedGame: data.selectedGame,
          mode: data.mode,
          atlasCategory: data.atlasCategory,
          settings: data.settings
        });
        io.to(room.roomCode).emit("game_selected", roomManager.publicState(room));
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("join_room", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const previousRoom = await leavePreviousSocketRoom(socket);
        const { room, player, reconnected } = roomManager.joinRoom({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerName: data.playerName,
          playerId: data.playerId
        });
        socket.join(room.roomCode);
        await notifyPreviousRoom(io, previousRoom, room.roomCode);
        socket.emit("room_joined", {
          roomCode: room.roomCode,
          playerId: player.playerId,
          state: roomManager.publicState(room)
        });
        socket.emit("chat_history", { roomCode: room.roomCode, messages: room.chatMessages });
        socket.to(room.roomCode).emit(reconnected ? "player_reconnected" : "player_joined", {
          roomCode: room.roomCode,
          playerId: player.playerId,
          playerName: player.playerName,
          message: `${player.playerName} ${reconnected ? "reconnected" : "joined"}.`
        });
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    const setReady = async (rawData) => {
      try {
        const data = payloadError(rawData);
        const room = data.ready === undefined
          ? roomManager.toggleReady({
            socketId: socket.id,
            roomCode: data.roomCode,
            playerId: data.playerId
          })
          : roomManager.setReady({
            socketId: socket.id,
            roomCode: data.roomCode,
            playerId: data.playerId,
            ready: data.ready
          });
        io.to(room.roomCode).emit("player_ready_updated", roomManager.publicState(room));
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    };

    socket.on("set_ready", setReady);
    socket.on("ready_toggle", setReady);

    const startSelectedGame = async (rawData) => {
      try {
        const data = payloadError(rawData);
        const room = roomManager.startSelectedGame({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        io.to(room.roomCode).emit("game_started", roomManager.publicState(room));
        if (room.selectedGame !== "sos") {
          io.to(room.roomCode).emit("round_started", roomManager.publicState(room));
        }
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    };

    socket.on("start_game", startSelectedGame);
    socket.on("start_selected_game", startSelectedGame);

    socket.on("make_move", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const room = roomManager.makeMove({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId,
          row: Number(data.row),
          col: Number(data.col),
          letter: data.letter
        });
        const state = roomManager.publicState(room);
        io.to(room.roomCode).emit("game_updated", state);
        await emitRoomState(io, room);
        if (room.gameOver) {
          io.to(room.roomCode).emit("game_over", state);
        }
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    const submitQuestionAnswer = async (rawData) => {
      try {
        const data = payloadError(rawData);
        const result = roomManager.submitQuestionAnswer({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId,
          answer: data.answer
        });
        const state = roomManager.publicState(result.room);
        if (result.changed) {
          io.to(result.room.roomCode).emit(result.room.gameOver ? "match_result" : "round_result", state);
          if (result.room.gameOver) {
            io.to(result.room.roomCode).emit("game_over", state);
          }
        } else {
          socket.emit("question_answer_feedback", { message: result.message, correct: false });
        }
        await emitRoomState(io, result.room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    };

    socket.on("submit_question_answer", submitQuestionAnswer);

    socket.on("submit_atlas_answer", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const result = roomManager.submitAtlasAnswer({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId,
          answer: data.answer
        });
        const state = roomManager.publicState(result.room);
        io.to(result.room.roomCode).emit("game_updated", state);
        if (!result.accepted) {
          socket.emit("atlas_answer_invalid", {
            reason: result.reason,
            message: result.message
          });
        }
        if (result.room.gameOver) {
          io.to(result.room.roomCode).emit("game_over", state);
        }
        await emitRoomState(io, result.room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("use_question_hint", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const result = roomManager.useQuestionHint({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        io.to(result.room.roomCode).emit("game_state_updated", roomManager.publicState(result.room));
        await emitRoomState(io, result.room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("next_round_request", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const result = roomManager.nextRoundRequest({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        io.to(result.room.roomCode).emit("round_started", roomManager.publicState(result.room));
        await emitRoomState(io, result.room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("back_to_lobby", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const room = roomManager.backToLobby({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        io.to(room.roomCode).emit("returned_to_lobby", roomManager.publicState(room));
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("rematch_request", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const { room } = roomManager.requestRematch({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        io.to(room.roomCode).emit("rematch_requested", {
          roomCode: room.roomCode,
          rematchVotes: [...room.rematchVotes],
          rematchStatus: room.rematchStatus
        });
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("rematch_accept", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const { room, restarted } = roomManager.acceptRematch({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        if (restarted) {
          io.to(room.roomCode).emit("rematch_started", roomManager.publicState(room));
        }
        await emitRoomState(io, room);
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("send_chat_message", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const { room, message } = roomManager.sendChatMessage({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId,
          text: data.text
        });
        io.to(room.roomCode).emit("chat_message", message);
      } catch (error) {
        socket.emit("chat_error", { message: error.message });
      }
    });

    socket.on("leave_room", async (rawData) => {
      try {
        const data = payloadError(rawData);
        const result = roomManager.leaveRoom({
          socketId: socket.id,
          roomCode: data.roomCode,
          playerId: data.playerId
        });
        socket.emit("left_room", { message: "You left the room." });
        if (result) {
          socket.leave(result.room.roomCode);
          socket.to(result.room.roomCode).emit("player_disconnected", {
            roomCode: result.room.roomCode,
            playerId: result.player.playerId,
            playerName: result.player.playerName,
            message: `${result.player.playerName} left the room.`
          });
          socket.to(result.room.roomCode).emit("player_left", {
            roomCode: result.room.roomCode,
            playerId: result.player.playerId,
            playerName: result.player.playerName,
            message: `${result.player.playerName} left the room.`
          });
          await emitRoomState(io, result.room);
        }
      } catch (error) {
        emitInvalid(socket, error.message);
      }
    });

    socket.on("disconnect", async () => {
      const result = roomManager.detachSocket(socket.id);
      if (result) {
        socket.to(result.room.roomCode).emit("player_disconnected", {
          roomCode: result.room.roomCode,
          playerId: result.player.playerId,
          playerName: result.player.playerName,
          message: `${result.player.playerName} disconnected.`
        });
        await emitRoomState(io, result.room);
      }
    });
  });

  setInterval(() => {
    roomManager.cleanupAbandonedRooms();
  }, config.cleanupIntervalMs).unref();

  setInterval(async () => {
    const now = Date.now();
    for (const room of roomManager.getActiveTimedRooms()) {
      const tick = roomManager.tickTimedGame(room.roomCode, now);
      const state = roomManager.publicState(tick.room);
      const gameState = state.currentGameState;
      if (gameState && !state.gameOver) {
        const remainingMs = gameState.roundLocked
          ? 0
          : Math.max(0, gameState.roundStartTime + gameState.roundTimeLimit - now);
        io.to(room.roomCode).emit("round_timer_update", {
          roomCode: room.roomCode,
          selectedGame: state.selectedGame,
          currentRound: gameState.currentRound,
          remainingMs
        });
      }
      if (tick.changed) {
        io.to(room.roomCode).emit(tick.event, state);
        await emitRoomState(io, tick.room);
        if (state.gameOver) {
          io.to(room.roomCode).emit("game_over", state);
        }
      }
    }
  }, 1000).unref();

  return io;
}
