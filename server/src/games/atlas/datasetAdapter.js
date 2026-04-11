import { buildAtlasDataset } from "./atlasLookup.js";
import { AtlasDatasetError, clearAtlasDatasetCache, loadAtlasDataset, resolveAtlasDatasetDirectory } from "./datasetLoader.js";
import {
  ATLAS_CATEGORIES,
  ATLAS_CATEGORY_INDIA_DISTRICTS,
  ATLAS_CATEGORY_INDIA_SUBDISTRICTS,
  ATLAS_CATEGORY_LABELS,
  ATLAS_CATEGORY_MIXED,
  ATLAS_CATEGORY_WORLD_CITIES,
  normalizeAtlasCategory,
  normalizeAtlasLookup,
  normalizeAtlasRecord
} from "./datasetNormalizer.js";

export {
  ATLAS_CATEGORIES,
  ATLAS_CATEGORY_INDIA_DISTRICTS,
  ATLAS_CATEGORY_INDIA_SUBDISTRICTS,
  ATLAS_CATEGORY_LABELS,
  ATLAS_CATEGORY_MIXED,
  ATLAS_CATEGORY_WORLD_CITIES,
  AtlasDatasetError,
  clearAtlasDatasetCache,
  loadAtlasDataset,
  normalizeAtlasCategory,
  normalizeAtlasLookup,
  resolveAtlasDatasetDirectory
};

export function createAtlasDataset(entries, source = "injected") {
  const normalizedEntries = [];
  let invalidRows = 0;

  for (const [index, record] of (entries || []).entries()) {
    const normalized = normalizeAtlasRecord(record, {
      index,
      sourceName: typeof source === "string" ? source : source?.source || "injected"
    });
    if (!normalized) {
      invalidRows += 1;
      continue;
    }
    normalizedEntries.push(normalized);
  }

  return buildAtlasDataset(normalizedEntries, {
    source: typeof source === "string" ? source : source?.source || "injected",
    directory: typeof source === "object" ? source?.directory || null : null,
    directoryName: typeof source === "object" ? source?.directoryName || null : null,
    invalidRows
  });
}

export function atlasCategoryView(dataset, category) {
  const normalizedCategory = normalizeAtlasCategory(category);
  return {
    category: normalizedCategory,
    label: ATLAS_CATEGORY_LABELS[normalizedCategory] || ATLAS_CATEGORY_LABELS[ATLAS_CATEGORY_MIXED],
    entries: dataset.byCategory[normalizedCategory] || [],
    lookup: dataset.lookupByCategory[normalizedCategory] || new Map(),
    globalLookup: dataset.lookupByCategory[ATLAS_CATEGORY_MIXED] || new Map(),
    recordsByStartingLetter: dataset.recordsByStartingLetter[normalizedCategory] || new Map(),
    recordsByNormalizedName: dataset.recordsByNormalizedName[normalizedCategory] || new Map(),
    source: dataset.source,
    directory: dataset.directory || null,
    summary: dataset.summary
  };
}
