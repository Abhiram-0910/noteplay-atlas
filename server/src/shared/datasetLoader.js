import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../../data");
export const DATA_PACK_DIR = path.resolve(__dirname, "../../../data/pack");
export const DEFAULT_DATA_DIRS = [
  { dir: DEFAULT_DATA_DIR, assetPrefix: "/dataset-assets/data" },
  { dir: DATA_PACK_DIR, assetPrefix: "/dataset-assets/pack" }
];
const datasetCache = new Map();

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function firstValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && cleanText(record[key])) {
      return record[key];
    }
  }
  return "";
}

function normalizeRecord(record, index, sourceName, assetPrefix = "") {
  const normalized = Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [String(key).trim().toLowerCase(), value])
  );
  const question = cleanText(firstValue(normalized, ["question", "prompt", "text"]));
  const answerRaw = firstValue(normalized, ["answer", "correct_answer", "correct", "solution"]);
  const answerText = cleanText(answerRaw);
  if (!question || !answerText) {
    return null;
  }

  return {
    id: cleanText(firstValue(normalized, ["id", "question_id"])) || `${sourceName}-${index + 1}`,
    question,
    answer: typeof answerRaw === "number" ? answerRaw : answerText,
    type: cleanText(firstValue(normalized, ["type", "question_type", "kind"])) || null,
    hint: cleanText(firstValue(normalized, ["hint", "clue"])) || null,
    difficulty: cleanText(firstValue(normalized, ["difficulty", "level"])) || null,
    category: cleanText(firstValue(normalized, ["category", "subcategory", "topic"])) || null,
    imageUrl: buildImageUrl(cleanText(firstValue(normalized, ["image_file", "image", "image_url"])), assetPrefix),
    imageDescription: cleanText(firstValue(normalized, ["image_description", "image_alt", "alt"])) || null
  };
}

function buildImageUrl(imageFile, assetPrefix) {
  if (!imageFile) {
    return null;
  }
  if (/^https?:\/\//i.test(imageFile) || imageFile.startsWith("data:")) {
    return imageFile;
  }
  if (!assetPrefix) {
    return null;
  }
  return `${assetPrefix}/${imageFile.replaceAll("\\", "/").replace(/^\/+/, "")}`;
}

function readJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw.questions)) {
    return raw.questions;
  }
  return [];
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function loadFile(filePath) {
  if (filePath.endsWith(".json")) {
    return readJson(filePath);
  }
  if (filePath.endsWith(".csv")) {
    return readCsv(filePath);
  }
  return [];
}

function datasetCacheKey({ dataDir, dataDirs, baseNames, label, allowedTypes }) {
  const resolvedDirs = dataDirs || (dataDir ? [{ dir: dataDir, assetPrefix: "" }] : DEFAULT_DATA_DIRS);
  return JSON.stringify({
    dirs: resolvedDirs.map((entry) => [entry.dir, entry.assetPrefix || ""]),
    baseNames,
    label,
    allowedTypes
  });
}

function preferredDatasetFile(dataSource, baseName) {
  const jsonPath = path.join(dataSource.dir, `${baseName}.json`);
  if (fs.existsSync(jsonPath)) {
    return jsonPath;
  }

  const csvPath = path.join(dataSource.dir, `${baseName}.csv`);
  if (fs.existsSync(csvPath)) {
    return csvPath;
  }

  return null;
}

function shouldUseRecord(record, allowedTypes) {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true;
  }
  const type = cleanText(record?.type).toLowerCase();
  return !type || allowedTypes.includes(type);
}

export function loadQuestionDataset({ dataDir, dataDirs, baseNames, fallbackRecords, label, allowedTypes }) {
  const cacheKey = datasetCacheKey({ dataDir, dataDirs, baseNames, label, allowedTypes });
  if (datasetCache.has(cacheKey)) {
    return datasetCache.get(cacheKey);
  }

  const dirs = dataDirs || (dataDir ? [{ dir: dataDir, assetPrefix: "" }] : DEFAULT_DATA_DIRS);
  const discoveredFiles = [];
  for (const dataSource of dirs) {
    for (const baseName of baseNames) {
      const filePath = preferredDatasetFile(dataSource, baseName);
      if (filePath) {
        discoveredFiles.push({ filePath, dataSource, baseName });
      }
    }
  }

  const mergedQuestions = [];
  const mergedSources = [];
  for (const { filePath, dataSource, baseName } of discoveredFiles) {
    const rawRecords = loadFile(filePath);
    const records = rawRecords
      .filter((record) => shouldUseRecord(record, allowedTypes))
      .map((record, index) => normalizeRecord(record, index, baseName, dataSource.assetPrefix))
      .filter(Boolean);

    if (records.length > 0) {
      mergedQuestions.push(...records);
      mergedSources.push(filePath);
    } else {
      console.warn(`[dataset] ${label} dataset at ${filePath} had no valid rows.`);
    }
  }

  const result = mergedQuestions.length > 0
    ? {
      questions: mergedQuestions,
      source: mergedSources.join(" + ")
    }
    : {
    questions: fallbackRecords.map((record, index) => normalizeRecord(record, index, `${label}-fallback`, "")).filter(Boolean),
    source: "fallback"
    };

  datasetCache.set(cacheKey, result);
  return result;
}
