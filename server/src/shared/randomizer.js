export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreTypeCandidate(type, remainingCount, lastType, secondLastType, rng) {
  let score = rng();
  if (type === lastType) {
    score += 8;
  }
  if (type === secondLastType) {
    score += 3;
  }
  return score - Math.min(remainingCount, 6) * 0.15;
}

function scoreQuestionCandidate(question, previousQuestion, rng) {
  let score = rng();
  if (!previousQuestion) {
    return score;
  }

  if (normalizeText(question.id) === normalizeText(previousQuestion.id)) {
    score += 12;
  }
  if (normalizeText(question.type) === normalizeText(previousQuestion.type)) {
    score += 4;
  }
  if (normalizeText(question.category) && normalizeText(question.category) === normalizeText(previousQuestion.category)) {
    score += 2.5;
  }
  if (normalizeText(question.difficulty) && normalizeText(question.difficulty) === normalizeText(previousQuestion.difficulty)) {
    score += 1.5;
  }
  return score;
}

function pickQuestionFromBucket(bucket, previousQuestion, rng) {
  if (bucket.length <= 1) {
    return bucket.shift();
  }

  const lookahead = Math.min(bucket.length, 8);
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lookahead; index += 1) {
    const score = scoreQuestionCandidate(bucket[index], previousQuestion, rng);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bucket.splice(bestIndex, 1)[0];
}

function createQuestionBuckets(questions) {
  const buckets = new Map();
  for (const question of questions) {
    const type = normalizeText(question.type) || "question";
    const bucket = buckets.get(type) || [];
    bucket.push(question);
    buckets.set(type, bucket);
  }
  return buckets;
}

function buildQuestionCycle(sourceQuestions, previousQuestion, recentQuestionIds, rng) {
  const recentSet = new Set((recentQuestionIds || []).map((questionId) => normalizeText(questionId)));
  const freshQuestions = [];
  const deferredQuestions = [];

  for (const question of sourceQuestions) {
    if (recentSet.has(normalizeText(question.id))) {
      deferredQuestions.push(question);
    } else {
      freshQuestions.push(question);
    }
  }

  const orderedQuestions = freshQuestions.length > 0
    ? [...shuffle(freshQuestions, rng), ...shuffle(deferredQuestions, rng)]
    : shuffle(sourceQuestions, rng);
  const buckets = createQuestionBuckets(orderedQuestions);
  const cycle = [];
  let lastType = normalizeText(previousQuestion?.type) || null;
  let secondLastType = null;
  let lastQuestion = previousQuestion || null;

  while ([...buckets.values()].some((bucket) => bucket.length > 0)) {
    let chosenType = null;
    let chosenScore = Number.POSITIVE_INFINITY;

    for (const [type, bucket] of buckets.entries()) {
      if (bucket.length === 0) {
        continue;
      }
      const score = scoreTypeCandidate(type, bucket.length, lastType, secondLastType, rng);
      if (score < chosenScore) {
        chosenScore = score;
        chosenType = type;
      }
    }

    if (!chosenType) {
      break;
    }

    const bucket = buckets.get(chosenType);
    const nextQuestion = pickQuestionFromBucket(bucket, lastQuestion, rng);
    if (!nextQuestion) {
      break;
    }

    cycle.push(nextQuestion);
    secondLastType = lastType;
    lastType = chosenType;
    lastQuestion = nextQuestion;
  }

  return cycle;
}

function refillQuestionQueue(sourceQuestions, queueState, rng, recentQuestionIds) {
  const previousQuestion = queueState.lastQuestionId
    ? {
      id: queueState.lastQuestionId,
      type: queueState.lastQuestionType,
      category: queueState.lastQuestionCategory,
      difficulty: queueState.lastQuestionDifficulty
    }
    : null;
  return buildQuestionCycle(sourceQuestions, previousQuestion, recentQuestionIds, rng);
}

export function drawRandomQuestionSet(sourceQuestions, count, queueState = {}, rng = Math.random, recentQuestionIds = []) {
  if (!Array.isArray(sourceQuestions) || sourceQuestions.length === 0) {
    throw new Error("Question dataset is empty.");
  }

  const picked = [];
  let remainingQuestions = Array.isArray(queueState.remainingQuestions) ? [...queueState.remainingQuestions] : [];
  let lastQuestionId = queueState.lastQuestionId ?? null;

  while (picked.length < count) {
    if (remainingQuestions.length === 0) {
      remainingQuestions = refillQuestionQueue(sourceQuestions, queueState, rng, recentQuestionIds);
    }

    const nextQuestion = remainingQuestions.shift();
    if (!nextQuestion) {
      continue;
    }

    picked.push(nextQuestion);
    lastQuestionId = nextQuestion.id;
    queueState = {
      lastQuestionId: nextQuestion.id,
      lastQuestionType: nextQuestion.type || null,
      lastQuestionCategory: nextQuestion.category || null,
      lastQuestionDifficulty: nextQuestion.difficulty || null
    };
  }

  return {
    questions: picked,
    queueState: {
      remainingQuestions,
      lastQuestionId,
      lastQuestionType: queueState.lastQuestionType || null,
      lastQuestionCategory: queueState.lastQuestionCategory || null,
      lastQuestionDifficulty: queueState.lastQuestionDifficulty || null
    }
  };
}

export function buildRandomQuestionSet(sourceQuestions, count, rng = Math.random) {
  return drawRandomQuestionSet(sourceQuestions, count, {}, rng).questions;
}
