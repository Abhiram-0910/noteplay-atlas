import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAtlasDataset } from "./atlasLookup.js";
import {
  ATLAS_CATEGORY_INDIA_DISTRICTS,
  ATLAS_CATEGORY_INDIA_SUBDISTRICTS,
  ATLAS_CATEGORY_WORLD_CITIES,
  normalizeAtlasRecord
} from "./datasetNormalizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT_DIR = path.resolve(__dirname, "../../../..");
const PROJECT_DATA_DIR = path.join(PROJECT_ROOT_DIR, "data");

const FULL_DATASET_DIR_NAME = "atlas_datasets_full";
const LIGHTER_DATASET_DIR_NAME = "atlas_datasets_lighter";
const ATLAS_DATASET_DIR_ENV = "ATLAS_DATASET_DIR";

const CATEGORY_FILE_SPECS = [
  {
    category: ATLAS_CATEGORY_WORLD_CITIES,
    baseNames: ["world_cities"]
  },
  {
    category: ATLAS_CATEGORY_INDIA_DISTRICTS,
    baseNames: ["india_districts"]
  },
  {
    category: ATLAS_CATEGORY_INDIA_SUBDISTRICTS,
    baseNames: ["india_subdistricts"]
  }
];

const MASTER_FILE_BASE_NAMES = ["atlas_master_large"];
const datasetCache = new Map();

export class AtlasDatasetError extends Error {
  constructor(message) {
    super(message);
    this.name = "AtlasDatasetError";
  }
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function uniquePaths(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => path.resolve(value)))];
}

function defaultSearchRoots() {
  return uniquePaths([PROJECT_ROOT_DIR, PROJECT_DATA_DIR, process.cwd()]);
}

function resolveSearchRoots(searchRoots = []) {
  if (!searchRoots.length) {
    return defaultSearchRoots();
  }
  return uniquePaths(searchRoots.map((root) => path.resolve(root)));
}

function resolveConfiguredCandidates(configuredDataDir, searchRoots) {
  const configured = cleanText(configuredDataDir);
  if (!configured) {
    return [];
  }
  if (path.isAbsolute(configured)) {
    return [configured];
  }
  return uniquePaths([
    ...searchRoots.map((root) => path.resolve(root, configured)),
    path.resolve(process.cwd(), configured)
  ]);
}

function atlasDatasetDirCandidates({ dataDir, configuredDataDir, searchRoots = [] } = {}) {
  const roots = resolveSearchRoots(searchRoots);
  const candidates = [
    ...resolveConfiguredCandidates(dataDir || configuredDataDir || process.env[ATLAS_DATASET_DIR_ENV], roots),
    ...roots.map((root) => path.resolve(root, FULL_DATASET_DIR_NAME)),
    ...roots.map((root) => path.resolve(root, LIGHTER_DATASET_DIR_NAME))
  ];
  return uniquePaths(candidates);
}

export function resolveAtlasDatasetDirectory(options = {}) {
  const candidates = atlasDatasetDirCandidates(options);
  for (const directory of candidates) {
    if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
      return {
        directory,
        directoryName: path.basename(directory),
        checkedDirectories: candidates
      };
    }
  }

  throw new AtlasDatasetError(
    [
      "No Atlas dataset directory was found.",
      `Generate one with \`python build_full_atlas_datasets.py --world-mode all --outdir ${FULL_DATASET_DIR_NAME}\``,
      `or \`python build_full_atlas_datasets.py --world-mode cities500 --outdir ${LIGHTER_DATASET_DIR_NAME}\`.`,
      `Checked: ${candidates.join(", ")}`
    ].join(" ")
  );
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

function readJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw.records)) {
    return raw.records;
  }
  if (Array.isArray(raw.items)) {
    return raw.items;
  }
  if (Array.isArray(raw.places)) {
    return raw.places;
  }
  return [];
}

function readCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => cleanText(line));
  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => cleanText(header).toLowerCase());
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

function preferredDatasetFile(directory, baseNames) {
  for (const baseName of baseNames) {
    const jsonPath = path.join(directory, `${baseName}.json`);
    if (fs.existsSync(jsonPath)) {
      return jsonPath;
    }
    const csvPath = path.join(directory, `${baseName}.csv`);
    if (fs.existsSync(csvPath)) {
      return csvPath;
    }
  }
  return null;
}

function loadAtlasRowsFromFile(filePath, { fallbackCategory = null, enforceCategory = false } = {}) {
  const rawRows = loadFile(filePath);
  const sourceName = path.basename(filePath, path.extname(filePath));
  const records = [];
  let invalidRows = 0;

  for (const [index, row] of rawRows.entries()) {
    const normalized = normalizeAtlasRecord(row, {
      index,
      sourceName,
      fallbackCategory,
      enforceCategory
    });
    if (!normalized) {
      invalidRows += 1;
      continue;
    }
    records.push(normalized);
  }

  return {
    records,
    invalidRows,
    rawRowCount: rawRows.length
  };
}

function addLoadedFile(loadedFiles, filePath) {
  if (filePath && !loadedFiles.includes(filePath)) {
    loadedFiles.push(filePath);
  }
}

function appendRecords(target, records) {
  for (const record of records) {
    target.push(record);
  }
}

function logAtlasDatasetSummary(dataset, logger) {
  const summary = dataset.summary;
  logger.info(`[atlas] dataset directory: ${summary.directory || "unknown"}`);
  logger.info(
    `[atlas] loaded=${summary.totalRecordsLoaded} world_cities=${summary.worldCitiesCount} ` +
    `india_districts=${summary.indiaDistrictsCount} india_subdistricts=${summary.indiaSubdistrictsCount} ` +
    `mixed=${summary.mixedCount} skipped=${summary.skippedRows}`
  );
}

function buildLoadedAtlasDataset(resolvedDirectory) {
  const loadedFiles = [];
  const files = {};
  const rawCountsByCategory = {
    [ATLAS_CATEGORY_WORLD_CITIES]: 0,
    [ATLAS_CATEGORY_INDIA_DISTRICTS]: 0,
    [ATLAS_CATEGORY_INDIA_SUBDISTRICTS]: 0
  };
  const records = [];
  let invalidRows = 0;
  let masterFileRows = 0;

  for (const fileSpec of CATEGORY_FILE_SPECS) {
    const filePath = preferredDatasetFile(resolvedDirectory.directory, fileSpec.baseNames);
    files[fileSpec.category] = filePath;
    if (!filePath) {
      continue;
    }

    addLoadedFile(loadedFiles, filePath);
    const result = loadAtlasRowsFromFile(filePath, {
      fallbackCategory: fileSpec.category,
      enforceCategory: true
    });
    appendRecords(records, result.records);
    rawCountsByCategory[fileSpec.category] = result.records.length;
    invalidRows += result.invalidRows;
  }

  const missingCategories = CATEGORY_FILE_SPECS.filter((fileSpec) => rawCountsByCategory[fileSpec.category] === 0);
  if (missingCategories.length > 0) {
    const masterFilePath = preferredDatasetFile(resolvedDirectory.directory, MASTER_FILE_BASE_NAMES);
    files.master = masterFilePath;
    if (masterFilePath) {
      addLoadedFile(loadedFiles, masterFilePath);
      const masterResult = loadAtlasRowsFromFile(masterFilePath);
      invalidRows += masterResult.invalidRows;
      masterFileRows = masterResult.records.length;

      const masterByCategory = new Map();
      for (const record of masterResult.records) {
        if (!masterByCategory.has(record.category)) {
          masterByCategory.set(record.category, []);
        }
        masterByCategory.get(record.category).push(record);
      }

      for (const fileSpec of missingCategories) {
        const fallbackRecords = masterByCategory.get(fileSpec.category) || [];
        if (fallbackRecords.length > 0) {
          appendRecords(records, fallbackRecords);
          rawCountsByCategory[fileSpec.category] = fallbackRecords.length;
          files[fileSpec.category] = masterFilePath;
        }
      }
    }
  } else {
    files.master = preferredDatasetFile(resolvedDirectory.directory, MASTER_FILE_BASE_NAMES);
  }

  if (records.length === 0) {
    throw new AtlasDatasetError(
      `Atlas dataset directory ${resolvedDirectory.directory} did not contain any valid world cities, India districts, or India subdistrict rows.`
    );
  }

  return buildAtlasDataset(records, {
    source: resolvedDirectory.directory,
    directory: resolvedDirectory.directory,
    directoryName: resolvedDirectory.directoryName,
    files,
    loadedFiles,
    invalidRows,
    rawCountsByCategory,
    masterFileRows
  });
}

export function clearAtlasDatasetCache() {
  datasetCache.clear();
}

export function loadAtlasDataset(options = {}) {
  const resolvedDirectory = resolveAtlasDatasetDirectory(options);
  const cacheKey = JSON.stringify({
    directory: resolvedDirectory.directory
  });

  if (datasetCache.has(cacheKey)) {
    return datasetCache.get(cacheKey);
  }

  const dataset = buildLoadedAtlasDataset(resolvedDirectory);
  datasetCache.set(cacheKey, dataset);

  const logger = options.logger || console;
  if (!options.silent && typeof logger?.info === "function") {
    logAtlasDatasetSummary(dataset, logger);
  }

  return dataset;
}
