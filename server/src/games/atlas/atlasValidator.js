import { ATLAS_CATEGORY_LABELS, ATLAS_CATEGORY_MIXED, cleanAtlasDisplayName, normalizeAtlasLookup } from "./datasetNormalizer.js";

export const ATLAS_VALIDATION_REASON_MATCH_OVER = "match_over";
export const ATLAS_VALIDATION_REASON_NOT_YOUR_TURN = "not_your_turn";
export const ATLAS_VALIDATION_REASON_EMPTY_ANSWER = "empty_answer";
export const ATLAS_VALIDATION_REASON_PLACE_NOT_FOUND = "place_not_found";
export const ATLAS_VALIDATION_REASON_WRONG_STARTING_LETTER = "wrong_starting_letter";
export const ATLAS_VALIDATION_REASON_ALREADY_USED = "already_used";
export const ATLAS_VALIDATION_REASON_INVALID_CATEGORY_ENTRY = "invalid_category_entry";
export const ATLAS_VALIDATION_REASON_TIMEOUT = "timeout";

function categoryLabel(category) {
  return ATLAS_CATEGORY_LABELS[category] || "the active Atlas category";
}

export function validateAtlasAnswer(state, { playerId, answer }) {
  if (state.gameOver) {
    return {
      ok: false,
      fatal: true,
      penalize: false,
      reason: ATLAS_VALIDATION_REASON_MATCH_OVER,
      submittedAnswer: null,
      message: "The match is already over."
    };
  }

  if (state.currentTurn !== playerId) {
    return {
      ok: false,
      fatal: true,
      penalize: false,
      reason: ATLAS_VALIDATION_REASON_NOT_YOUR_TURN,
      submittedAnswer: null,
      message: "It is not your turn."
    };
  }

  const submittedAnswer = cleanAtlasDisplayName(answer);
  const normalizedSubmittedAnswer = normalizeAtlasLookup(submittedAnswer);
  if (!submittedAnswer || !normalizedSubmittedAnswer) {
    return {
      ok: false,
      fatal: false,
      penalize: true,
      reason: ATLAS_VALIDATION_REASON_EMPTY_ANSWER,
      submittedAnswer,
      message: "Answer cannot be empty."
    };
  }

  const entry = state.allowedLookup.get(normalizedSubmittedAnswer);
  if (!entry) {
    const knownEntry = state.category !== ATLAS_CATEGORY_MIXED
      ? state.allCategoryLookup?.get(normalizedSubmittedAnswer)
      : null;
    if (knownEntry) {
      return {
        ok: false,
        fatal: false,
        penalize: true,
        reason: ATLAS_VALIDATION_REASON_INVALID_CATEGORY_ENTRY,
        submittedAnswer,
        entry: knownEntry,
        message: `${knownEntry.name} is not part of ${categoryLabel(state.category)}.`
      };
    }

    return {
      ok: false,
      fatal: false,
      penalize: true,
      reason: ATLAS_VALIDATION_REASON_PLACE_NOT_FOUND,
      submittedAnswer,
      message: "Place not found in the active Atlas dataset."
    };
  }

  if (state.category !== ATLAS_CATEGORY_MIXED && entry.category !== state.category) {
    return {
      ok: false,
      fatal: false,
      penalize: true,
      reason: ATLAS_VALIDATION_REASON_INVALID_CATEGORY_ENTRY,
      submittedAnswer,
      entry,
      message: `${entry.name} is not part of ${categoryLabel(state.category)}.`
    };
  }

  const alreadyUsed = state.usedEntryIds.has(entry.id)
    || entry.normalizedVariants.some((variant) => state.usedAnswerKeys.has(variant));
  if (alreadyUsed) {
    return {
      ok: false,
      fatal: false,
      penalize: true,
      reason: ATLAS_VALIDATION_REASON_ALREADY_USED,
      submittedAnswer,
      entry,
      message: "That place was already used in this match."
    };
  }

  if (state.requiredStartingLetter && entry.startingLetter !== state.requiredStartingLetter) {
    return {
      ok: false,
      fatal: false,
      penalize: true,
      reason: ATLAS_VALIDATION_REASON_WRONG_STARTING_LETTER,
      submittedAnswer,
      entry,
      message: `Answer must start with ${state.requiredStartingLetter}.`
    };
  }

  return {
    ok: true,
    fatal: false,
    penalize: false,
    reason: null,
    submittedAnswer,
    normalizedSubmittedAnswer,
    entry,
    message: `${entry.name} accepted.`
  };
}
