import { useEffect, useMemo, useRef, useState } from "react";
import { createSocket } from "./socket.js";
import HomePage from "./pages/HomePage.jsx";
import GamePage from "./pages/GamePage.jsx";
import { projectConfig } from "./projectConfig.js";

const STORAGE_PREFIX = projectConfig.storagePrefix;
const STORAGE_KEYS = {
  serverUrl: `${STORAGE_PREFIX}:serverUrl`,
  playerId: `${STORAGE_PREFIX}:playerId`,
  playerName: `${STORAGE_PREFIX}:playerName`,
  roomCode: `${STORAGE_PREFIX}:roomCode`
};

function defaultServerUrl() {
  const saved = localStorage.getItem(STORAGE_KEYS.serverUrl);
  if (saved) {
    return saved;
  }
  if (!window.location.port || window.location.port === String(projectConfig.serverPort)) {
    return window.location.origin;
  }
  return `${window.location.protocol}//${window.location.hostname}:${projectConfig.serverPort}`;
}

export default function App() {
  const socketRef = useRef(null);
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [playerName, setPlayerName] = useState(localStorage.getItem(STORAGE_KEYS.playerName) || "");
  const [playerId, setPlayerId] = useState(localStorage.getItem(STORAGE_KEYS.playerId) || "");
  const [roomCode, setRoomCode] = useState(localStorage.getItem(STORAGE_KEYS.roomCode) || "");
  const [roomState, setRoomState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [status, setStatus] = useState(`Start the ${projectConfig.appName} server, then create or join a room.`);
  const [questionFeedback, setQuestionFeedback] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("S");

  const me = useMemo(() => {
    return roomState?.players?.find((player) => player.playerId === playerId) || null;
  }, [roomState, playerId]);

  function saveSession(nextPlayerId = playerId, nextRoomCode = roomCode, nextPlayerName = playerName, nextServerUrl = serverUrl) {
    if (nextPlayerId) localStorage.setItem(STORAGE_KEYS.playerId, nextPlayerId);
    if (nextRoomCode) localStorage.setItem(STORAGE_KEYS.roomCode, nextRoomCode);
    if (nextPlayerName) localStorage.setItem(STORAGE_KEYS.playerName, nextPlayerName);
    if (nextServerUrl) localStorage.setItem(STORAGE_KEYS.serverUrl, nextServerUrl);
  }

  function clearSession() {
    setPlayerId("");
    setRoomCode("");
    setRoomState(null);
    setChatMessages([]);
    setQuestionFeedback("");
    localStorage.removeItem(STORAGE_KEYS.playerId);
    localStorage.removeItem(STORAGE_KEYS.roomCode);
  }

  function bindSocket(socket) {
    socket.on("connect", () => {
      setConnected(true);
      setConnectionState("connected");
      setStatus("Connected");
      const savedPlayerId = localStorage.getItem(STORAGE_KEYS.playerId);
      const savedRoomCode = localStorage.getItem(STORAGE_KEYS.roomCode);
      const savedPlayerName = localStorage.getItem(STORAGE_KEYS.playerName);
      if (savedPlayerId && savedRoomCode && savedPlayerName) {
        socket.emit("join_room", {
          roomCode: savedRoomCode,
          playerName: savedPlayerName,
          playerId: savedPlayerId
        });
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setConnectionState("reconnecting");
      setStatus("Disconnected. Reconnecting...");
    });

    socket.on("connect_error", () => {
      setConnected(false);
      setConnectionState("error");
      setStatus(`Could not connect to ${serverUrl.trim() || defaultServerUrl()}. Start the ${projectConfig.appName} server.`);
    });

    socket.on("room_created", (payload) => {
      setPlayerId(payload.playerId);
      setRoomCode(payload.roomCode);
      setRoomState(payload.state);
      setChatMessages(payload.state.chatMessages || []);
      saveSession(payload.playerId, payload.roomCode);
      setStatus("Room created. Share the room code.");
    });

    socket.on("room_joined", (payload) => {
      setPlayerId(payload.playerId);
      setRoomCode(payload.roomCode);
      setRoomState(payload.state);
      setChatMessages(payload.state.chatMessages || []);
      saveSession(payload.playerId, payload.roomCode);
      setStatus("Joined room.");
    });

    const updateRoom = (state) => {
      setRoomState(state);
      setRoomCode(state.roomCode);
      setQuestionFeedback("");
      if (state.chatMessages) {
        setChatMessages(state.chatMessages);
      }
      saveSession(undefined, state.roomCode);
    };

    socket.on("room_updated", updateRoom);
    socket.on("game_selected", updateRoom);
    socket.on("player_ready_updated", updateRoom);
    socket.on("game_started", updateRoom);
    socket.on("game_updated", updateRoom);
    socket.on("game_state_updated", updateRoom);
    socket.on("round_started", updateRoom);
    socket.on("round_result", updateRoom);
    socket.on("match_result", updateRoom);
    socket.on("game_over", updateRoom);
    socket.on("rematch_started", updateRoom);
    socket.on("returned_to_lobby", updateRoom);

    socket.on("round_timer_update", (payload) => {
      setRoomState((current) => {
        if (!current || current.roomCode !== payload.roomCode || current.selectedGame !== payload.selectedGame) {
          return current;
        }
        const currentGameState = current.currentGameState;
        if (!currentGameState || currentGameState.currentRound !== payload.currentRound) {
          return current;
        }
        return {
          ...current,
          currentGameState: {
            ...currentGameState,
            remainingMs: payload.remainingMs
          }
        };
      });
    });

    socket.on("chat_history", (payload) => {
      setChatMessages(payload.messages || []);
    });

    socket.on("chat_message", (message) => {
      setChatMessages((current) => {
        if (current.some((existing) => existing.messageId === message.messageId)) {
          return current;
        }
        return [...current, message];
      });
    });

    socket.on("chat_error", (payload) => {
      setStatus(payload.message || "Chat message failed.");
    });

    socket.on("question_answer_feedback", (payload) => {
      setQuestionFeedback(payload?.message || "");
    });

    socket.on("atlas_answer_invalid", (payload) => {
      setStatus(payload?.message || "Invalid Atlas answer.");
    });

    socket.on("invalid_action", (payload) => {
      setStatus(payload.message || "Invalid action.");
    });

    socket.on("error_message", (payload) => {
      setStatus(payload.message || "Something went wrong.");
    });

    socket.on("player_joined", (payload) => setStatus(payload.message || "A player joined."));
    socket.on("player_left", (payload) => setStatus(payload.message || "A player left."));
    socket.on("player_disconnected", (payload) => setStatus(payload.message || "A player disconnected."));
    socket.on("player_reconnected", (payload) => setStatus(payload.message || "A player reconnected."));
    socket.on("rematch_requested", () => setStatus("Rematch requested."));
    socket.on("left_room", () => {
      clearSession();
      setStatus("You left the room.");
    });
  }

  function connect() {
    const trimmedUrl = serverUrl.trim() || defaultServerUrl();
    setServerUrl(trimmedUrl);
    setConnectionState("connecting");
    setStatus(`Connecting to ${trimmedUrl}...`);
    localStorage.setItem(STORAGE_KEYS.serverUrl, trimmedUrl);
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    const socket = createSocket(trimmedUrl);
    socketRef.current = socket;
    bindSocket(socket);
    return socket;
  }

  function ensureSocket() {
    if (socketRef.current?.connected) {
      return socketRef.current;
    }
    return connect();
  }

  function createRoom({ nextPlayerName, settings }) {
    const cleanName = nextPlayerName.trim();
    if (!cleanName) {
      setStatus("Enter your player name.");
      return;
    }
    clearSession();
    setPlayerName(cleanName);
    localStorage.setItem(STORAGE_KEYS.playerName, cleanName);
    const socket = ensureSocket();
    socket.emit("create_room", {
      playerName: cleanName,
      selectedGame: projectConfig.gameId,
      settings,
      mode: settings?.sosMode,
      atlasCategory: settings?.atlasCategory
    });
  }

  function joinRoom({ nextPlayerName, nextRoomCode }) {
    const cleanName = nextPlayerName.trim();
    const cleanCode = nextRoomCode.trim().toUpperCase();
    if (!cleanName) {
      setStatus("Enter your player name.");
      return;
    }
    if (!cleanCode) {
      setStatus("Enter a room code.");
      return;
    }
    const savedRoomCode = localStorage.getItem(STORAGE_KEYS.roomCode);
    const savedPlayerId = localStorage.getItem(STORAGE_KEYS.playerId);
    const rejoinPlayerId = savedRoomCode === cleanCode ? savedPlayerId : "";
    setPlayerName(cleanName);
    setRoomCode(cleanCode);
    setPlayerId(rejoinPlayerId || "");
    localStorage.setItem(STORAGE_KEYS.playerName, cleanName);
    const socket = ensureSocket();
    socket.emit("join_room", {
      roomCode: cleanCode,
      playerName: cleanName,
      playerId: rejoinPlayerId || undefined
    });
  }

  function emitRoomAction(eventName, extra = {}) {
    if (!socketRef.current || !roomCode || !playerId) {
      setStatus("You are not connected to a room.");
      return;
    }
    socketRef.current.emit(eventName, { roomCode, playerId, ...extra });
  }

  function leaveRoom() {
    if (socketRef.current?.connected && roomCode && playerId) {
      socketRef.current.emit("leave_room", { roomCode, playerId });
    } else {
      clearSession();
    }
  }

  useEffect(() => {
    if (playerId && roomCode && playerName) {
      connect();
    }
    return () => {
      socketRef.current?.disconnect();
    };
    // Run once on load to support refresh reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!roomState) {
    return (
      <HomePage
        connected={connected}
        connectionState={connectionState}
        createRoom={createRoom}
        joinRoom={joinRoom}
        playerName={playerName}
        serverUrl={serverUrl}
        setPlayerName={setPlayerName}
        setServerUrl={setServerUrl}
        status={status}
      />
    );
  }

  return (
    <GamePage
      chatMessages={chatMessages}
      connected={connected}
      leaveRoom={leaveRoom}
      me={me}
      playerId={playerId}
      roomState={roomState}
      questionFeedback={questionFeedback}
      selectedLetter={selectedLetter}
      serverUrl={serverUrl}
      sendChatMessage={(text) => emitRoomAction("send_chat_message", { text })}
      setReady={(ready) => emitRoomAction("ready_toggle", { ready })}
      setSelectedLetter={setSelectedLetter}
      selectGame={(selectedGame, settings) => emitRoomAction("select_game", {
        selectedGame,
        settings,
        mode: settings?.sosMode,
        atlasCategory: settings?.atlasCategory
      })}
      startGame={() => emitRoomAction("start_selected_game")}
      makeMove={(row, col) => emitRoomAction("make_move", { row, col, letter: selectedLetter })}
      submitQuestionAnswer={(answer) => {
        setQuestionFeedback("");
        emitRoomAction("submit_question_answer", { answer });
      }}
      submitAtlasAnswer={(answer) => emitRoomAction("submit_atlas_answer", { answer })}
      useQuestionHint={() => emitRoomAction("use_question_hint")}
      nextRound={() => emitRoomAction("next_round_request")}
      requestRematch={() => emitRoomAction("rematch_request")}
      acceptRematch={() => emitRoomAction("rematch_accept")}
      backToLobby={() => emitRoomAction("back_to_lobby")}
      status={status}
    />
  );
}
