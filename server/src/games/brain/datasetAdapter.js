import { loadMathQuestions } from "./math/datasetAdapter.js";
import { MATH_QUESTIONS } from "./math/questionGenerator.js";
import { loadRiddleQuestions } from "./riddle/datasetAdapter.js";
import { RIDDLE_QUESTIONS } from "./riddle/questionBank.js";

function normalizeType(question, fallbackType) {
  const rawType = String(question.type || fallbackType || "").trim().toLowerCase();
  if (["aots", "aptitude", "math", "logic"].includes(rawType)) {
    return rawType;
  }
  if (["visual", "number"].includes(rawType)) {
    return "aots";
  }
  if (rawType === "riddle") {
    return "riddle";
  }
  return fallbackType;
}

function withType(question, fallbackType) {
  return {
    ...question,
    type: normalizeType(question, fallbackType),
    category: question.category || fallbackType
  };
}

function uniqueQuestionKey(question) {
  return [
    question.type || "question",
    String(question.id ?? "").trim().toLowerCase(),
    String(question.question ?? "").trim().toLowerCase(),
    String(question.answer ?? "").trim().toLowerCase()
  ].join("::");
}

export function loadQuestionGameQuestions(options = {}) {
  const riddleDataset = options.riddleQuestions
    ? { questions: options.riddleQuestions, source: "injected-riddles" }
    : loadRiddleQuestions(options.datasetOptions || options);
  const aotsDataset = options.mathQuestions || options.aotsQuestions
    ? { questions: options.mathQuestions || options.aotsQuestions, source: "injected-aots" }
    : loadMathQuestions(options.datasetOptions || options);

  const hasExternalRiddles = riddleDataset.source !== "fallback";
  const hasExternalAots = aotsDataset.source !== "fallback";
  const useRiddles = hasExternalRiddles || !hasExternalAots;
  const useAots = hasExternalAots || !hasExternalRiddles;

  const questions = [
    ...(useRiddles ? riddleDataset.questions.map((question) => withType(question, "riddle")) : []),
    ...(useAots ? aotsDataset.questions.map((question) => withType(question, "aots")) : [])
  ]
    .filter((question, index, records) => records.findIndex((candidate) => uniqueQuestionKey(candidate) === uniqueQuestionKey(question)) === index)
    .map((question, index) => ({
      ...question,
      id: `${question.type || "question"}:${question.id || index}`
    }));

  if (questions.length === 0) {
    return {
      questions: [
        ...RIDDLE_QUESTIONS.map((question) => withType(question, "riddle")),
        ...MATH_QUESTIONS.map((question) => withType(question, "aots"))
      ],
      source: "fallback"
    };
  }

  return {
    questions,
    source: `${riddleDataset.source} + ${aotsDataset.source}`
  };
}
