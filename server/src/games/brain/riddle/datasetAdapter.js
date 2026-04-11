import { loadQuestionDataset } from "../../../shared/datasetLoader.js";
import { RIDDLE_QUESTIONS } from "./questionBank.js";

const FALLBACK_RIDDLE_SAMPLE = RIDDLE_QUESTIONS.slice(0, 5);

export function loadRiddleQuestions(options = {}) {
  return loadQuestionDataset({
    ...options,
    baseNames: ["riddles", "riddle", "riddles_only", "questions"],
    fallbackRecords: FALLBACK_RIDDLE_SAMPLE,
    label: "riddle",
    allowedTypes: ["riddle"]
  });
}
