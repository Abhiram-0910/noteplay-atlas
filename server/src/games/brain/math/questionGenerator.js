export const MATH_QUESTIONS = [
  { id: "m1", question: "8 + 7 = ?", answer: 15, category: "addition", difficulty: "easy" },
  { id: "m2", question: "21 - 9 = ?", answer: 12, category: "subtraction", difficulty: "easy" },
  { id: "m3", question: "6 x 7 = ?", answer: 42, category: "multiplication", difficulty: "easy" },
  { id: "m4", question: "48 / 6 = ?", answer: 8, category: "division", difficulty: "easy" },
  { id: "m5", question: "What number comes next: 3, 6, 9, 12, ?", answer: 15, category: "pattern", difficulty: "easy" },
  { id: "m6", question: "5 + 4 x 2 = ?", answer: 13, category: "expression", difficulty: "medium" },
  { id: "m7", question: "If x + 8 = 20, what is x?", answer: 12, category: "algebra", difficulty: "easy" },
  { id: "m8", question: "Which is greater: 9 x 5 or 8 x 6? Enter the greater value.", answer: 48, category: "comparison", difficulty: "medium" },
  { id: "m9", question: "Half of 34 is ?", answer: 17, category: "logic", difficulty: "easy" },
  { id: "m10", question: "12 x 3 = ?", answer: 36, category: "multiplication", difficulty: "easy" },
  { id: "m11", question: "81 / 9 = ?", answer: 9, category: "division", difficulty: "easy" },
  { id: "m12", question: "17 + 25 = ?", answer: 42, category: "addition", difficulty: "medium" },
  { id: "m13", question: "What number is missing: 4, 8, 16, ?, 64", answer: 32, category: "pattern", difficulty: "medium" },
  { id: "m14", question: "If 3 boxes hold 18 apples, how many apples per box?", answer: 6, category: "logic", difficulty: "easy" },
  { id: "m15", question: "100 - 37 = ?", answer: 63, category: "subtraction", difficulty: "medium" },
  { id: "m16", question: "7 x 8 = ?", answer: 56, category: "multiplication", difficulty: "easy" },
  { id: "m17", question: "If x - 5 = 14, what is x?", answer: 19, category: "algebra", difficulty: "easy" },
  { id: "m18", question: "What is 6 squared?", answer: 36, category: "expression", difficulty: "medium" },
  { id: "m19", question: "What number comes next: 2, 4, 8, 16, ?", answer: 32, category: "pattern", difficulty: "medium" },
  { id: "m20", question: "72 / 8 = ?", answer: 9, category: "division", difficulty: "easy" }
];

export function generateMathQuestions(totalRounds = 5) {
  return MATH_QUESTIONS.slice(0, totalRounds);
}

