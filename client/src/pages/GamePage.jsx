import { useEffect, useState } from "react";
import ChatBox from "../components/ChatBox.jsx";
import Lobby from "../components/Lobby.jsx";
import ResultModal from "../components/ResultModal.jsx";
import RulesModal from "../components/RulesModal.jsx";
import Scoreboard from "../components/Scoreboard.jsx";
import StatusBar from "../components/StatusBar.jsx";
import UtilityPanel from "../components/UtilityPanel.jsx";
import AtlasGame from "../games/atlas/AtlasGame.jsx";
import AtlasStatusPanel from "../games/atlas/AtlasStatusPanel.jsx";
import BrainGame from "../games/brain/BrainGame.jsx";
import QuestionRoundModal from "../games/brain/QuestionRoundModal.jsx";
import ScratchPad from "../games/brain/ScratchPad.jsx";
import SOSBoard from "../games/sos/SOSBoard.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";

function GameRenderer({
  roomState,
  gameState,
  feedbackMessage,
  me,
  playerId,
  selectedLetter,
  setSelectedLetter,
  makeMove,
  submitQuestionAnswer,
  submitAtlasAnswer,
  useQuestionHint,
  nextRound,
  openRules,
  serverUrl
}) {
  const isBrainGame = roomState.selectedGame === "brain";
  const isAtlasGame = roomState.selectedGame === "atlas";

  if (!gameState) {
    return (
      <section className="panel question-panel">
        <p className="eyebrow">Loading</p>
        <h2>Preparing {roomState.selectedGameLabel || "game"}</h2>
        <p>Waiting for the server to send the current game state.</p>
      </section>
    );
  }

  if (isBrainGame) {
    return (
      <BrainGame
        feedbackMessage={feedbackMessage}
        gameState={gameState}
        me={me}
        onHowToPlay={openRules}
        onNextRound={nextRound}
        onSubmitAnswer={submitQuestionAnswer}
        onUseHint={useQuestionHint}
        players={roomState.players}
        serverUrl={serverUrl}
      />
    );
  }

  if (isAtlasGame) {
    return (
      <AtlasGame
        gameState={gameState}
        me={me}
        onHowToPlay={openRules}
        onSubmitAnswer={submitAtlasAnswer}
      />
    );
  }

  return (
    <SOSBoard
      gameState={gameState}
      makeMove={makeMove}
      me={me}
      onHowToPlay={openRules}
      playerId={playerId}
      selectedLetter={selectedLetter}
      setSelectedLetter={setSelectedLetter}
    />
  );
}

export default function GamePage({
  chatMessages,
  connected,
  leaveRoom,
  me,
  playerId,
  roomState,
  selectedLetter,
  serverUrl,
  sendChatMessage,
  selectGame,
  setReady,
  setSelectedLetter,
  startGame,
  makeMove,
  submitQuestionAnswer,
  submitAtlasAnswer,
  useQuestionHint,
  nextRound,
  requestRematch,
  acceptRematch,
  backToLobby,
  questionFeedback,
  status
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(roomState.gameOver);
  const gameState = roomState.currentGameState;
  const isCompact = useMediaQuery("(max-width: 899px)");
  const isHost = roomState.hostPlayerId === playerId;
  const isBrainGame = roomState.selectedGame === "brain";
  const isAtlasGame = roomState.selectedGame === "atlas";

  useEffect(() => {
    if (roomState.gameOver) {
      setResultOpen(true);
    } else {
      setResultOpen(false);
    }
  }, [roomState.gameOver]);

  if (!roomState.gameStarted) {
    return (
      <main className="game-page">
        <StatusBar connected={connected} playerId={playerId} roomState={roomState} status={status} />
        <Lobby
          chatMessages={chatMessages}
          leaveRoom={leaveRoom}
          playerId={playerId}
          roomState={roomState}
          selectGame={selectGame}
          sendChatMessage={sendChatMessage}
          setReady={setReady}
          startGame={startGame}
          status={status}
        />
      </main>
    );
  }

  return (
    <main className="game-page">
      <StatusBar connected={connected} playerId={playerId} roomState={roomState} status={status} />

      <div className={`game-layout ${isAtlasGame || isBrainGame ? "brain-layout" : "sos-layout"}`}>
        <section className="board-column">
          <GameRenderer
            feedbackMessage={questionFeedback}
            gameState={gameState}
            makeMove={makeMove}
            me={me}
            nextRound={nextRound}
            openRules={() => setRulesOpen(true)}
            playerId={playerId}
            roomState={roomState}
            selectedLetter={selectedLetter}
            serverUrl={serverUrl}
            setSelectedLetter={setSelectedLetter}
            submitAtlasAnswer={submitAtlasAnswer}
            submitQuestionAnswer={submitQuestionAnswer}
            useQuestionHint={useQuestionHint}
          />
        </section>

        <aside className="status-column">
          {isAtlasGame ? (
            <AtlasStatusPanel gameState={gameState} playerId={playerId} players={roomState.players} roomState={roomState} />
          ) : (
            <>
              <Scoreboard currentTurn={roomState.currentTurn} playerId={playerId} players={roomState.players} />
              <section className="players panel-section">
                <p className="eyebrow">Players</p>
                <h2>Players</h2>
                {roomState.players.map((player) => (
                  <div className="player-row" key={player.playerId}>
                    <span>{player.playerName}{player.playerId === playerId ? " (you)" : ""}</span>
                    <div className="player-meta-row">
                      {player.playerId === roomState.hostPlayerId ? <span className="player-badge">Host</span> : null}
                      <span className={`player-badge ${player.connected ? "good" : "bad"}`}>{player.connected ? "Connected" : "Disconnected"}</span>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
        </aside>

        <aside className="utility-column">
          <UtilityPanel collapsible={isCompact} defaultOpen={!isCompact} eyebrow="Chat" title="Room chat">
            <ChatBox
              disabled={!me?.connected}
              framed={false}
              messages={chatMessages}
              onSend={sendChatMessage}
              playerId={playerId}
              showHeading={false}
            />
          </UtilityPanel>

          {isBrainGame ? (
            <UtilityPanel collapsible={isCompact} defaultOpen={!isCompact} eyebrow="Tools" title="Scratchpad">
              <ScratchPad framed={false} showHeading={false} />
            </UtilityPanel>
          ) : null}

          <section className="panel-section room-actions-panel">
            <p className="eyebrow">Room actions</p>
            <h2>Session</h2>
            <div className="button-row">
              {roomState.gameOver && isHost && (
                <button type="button" onClick={backToLobby}>Back to Lobby</button>
              )}
              <button type="button" className="secondary" onClick={leaveRoom}>Leave room</button>
            </div>
          </section>
        </aside>
      </div>

      {isBrainGame ? <QuestionRoundModal gameState={gameState} onNextRound={nextRound} players={roomState.players} /> : null}

      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        selectedGame={roomState.selectedGame}
        startLabel="Close"
      />
      {roomState.gameOver && resultOpen && (
        <ResultModal
          onBackToLobby={backToLobby}
          onClose={() => setResultOpen(false)}
          onLeave={leaveRoom}
          onRematchAccept={acceptRematch}
          onRematchRequest={requestRematch}
          playerId={playerId}
          roomState={roomState}
        />
      )}
    </main>
  );
}
