import { ATLAS_CATEGORY_LABELS, ATLAS_MODE_LABEL } from "./atlas/atlasOptions.js";

function normalizeGameKey(selectedGame) {
  const value = String(selectedGame || "sos").trim().toLowerCase();
  if (value === "question") {
    return "brain";
  }
  return value;
}

export const GAME_INFO = {
  atlas: {
    id: "atlas",
    title: "Atlas",
    shortTitle: "Atlas",
    description: "A real-time geography word chain. Each accepted answer sets the next starting letter, and every mistake costs a life.",
    scoring: "Lives Mode. Every invalid answer, repeated answer, wrong starting letter, or timeout removes 1 life.",
    rounds: "Continuous turn chain",
    timer: "20 seconds per turn",
    rules: [
      "Players take turns naming valid places from the selected Atlas dataset category.",
      "Hosts can choose World Cities, India Districts, India Subdistricts, or Mixed before the match starts.",
      "The first accepted answer can start with any letter.",
      "Each new answer must start with the last valid letter of the previous accepted answer.",
      "Repeated answers are not allowed, including aliases of already used places.",
      "The server validates every answer against the generated Atlas dataset folders.",
      "Wrong answers, repeats, wrong starting letters, and timeouts each cost 1 life.",
      "A player is eliminated when all lives are gone.",
      "Last remaining player wins the match."
    ]
  },
  sos: {
    id: "sos",
    title: "SOS",
    shortTitle: "SOS",
    description: "A strict 8x8 word duel. Place S or O, build SOS lines in any direction, and keep the turn when you score.",
    scoring: "Every SOS gives 1 point. A scoring move grants another turn.",
    rounds: "One 8x8 board",
    timer: "No timer",
    rules: [
      "The board size is 8x8.",
      "Two players play in turns.",
      "On each turn, choose either S or O.",
      "Place the chosen letter in any empty cell.",
      "SOS can be formed horizontally, vertically, or diagonally.",
      "Every SOS gives 1 point.",
      "If you create an SOS, you immediately play again.",
      "One move can create multiple SOS patterns.",
      "In General Mode, the game ends when the board is full.",
      "In Simple Mode, the first player to create SOS wins instantly."
    ]
  },
  brain: {
    id: "brain",
    title: "Brain Battle",
    shortTitle: "Brain Battle",
    description: "One combined question mode built from riddles, AOTS, aptitude, logic, and math prompts. Both players race on the same question and the server scores the round.",
    scoring: "First correct answer scores 10 base points, earns a speed bonus, and can build a streak. Revealing a hint lowers the round value.",
    rounds: "5 rounds",
    timer: "75 seconds per round",
    rules: [
      "Brain Battle combines Riddle, AOTS, aptitude, logic, and math prompts into one mode.",
      "Both players get the same question from one mixed dataset pool.",
      "Answer as quickly as possible before the timer ends.",
      "The first correct answer wins the round and gets the full score reward.",
      "Hints reduce the available points for that round.",
      "Back-to-back round wins add a streak bonus.",
      "If time runs out, the answer is revealed and the round scores zero.",
      "Highest total score after all rounds wins the match."
    ]
  }
};

export function getGameInfo(selectedGame) {
  return GAME_INFO[normalizeGameKey(selectedGame)] || GAME_INFO.sos;
}

export function getGameSettingSummary(selectedGame, gameSettings = {}) {
  const gameKey = normalizeGameKey(selectedGame);
  if (gameKey === "sos") {
    return {
      modeLabel: gameSettings?.sosMode === "simple" ? "Simple" : "General"
    };
  }
  if (gameKey === "atlas") {
    return {
      categoryLabel: ATLAS_CATEGORY_LABELS[gameSettings?.atlasCategory || "mixed"] || ATLAS_CATEGORY_LABELS.mixed,
      modeLabel: ATLAS_MODE_LABEL
    };
  }
  return {};
}
