import { loadQuestionDataset } from "../../../shared/datasetLoader.js";
import { MATH_QUESTIONS } from "./questionGenerator.js";

const FALLBACK_MATH_SAMPLE = MATH_QUESTIONS.slice(0, 5);

export function loadMathQuestions(options = {}) {
  return loadQuestionDataset({
    ...options,
    baseNames: ["aots", "math", "math_only", "mathematical", "questions"],
    fallbackRecords: FALLBACK_MATH_SAMPLE,
    label: "aots-math",
    allowedTypes: ["math", "aots", "aptitude", "logic"]
  });
}
