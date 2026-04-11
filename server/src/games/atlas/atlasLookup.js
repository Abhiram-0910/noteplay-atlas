import {
  ATLAS_CATEGORY_INDIA_DISTRICTS,
  ATLAS_CATEGORY_INDIA_SUBDISTRICTS,
  ATLAS_CATEGORY_MIXED,
  ATLAS_CATEGORY_WORLD_CITIES,
  ATLAS_RECORD_CATEGORIES
} from "./datasetNormalizer.js";

function recordMetadataScore(record) {
  let score = 0;
  if (record.country) {
    score += 4;
  }
  if (record.state) {
    score += 2;
  }
  if (record.district) {
    score += 1;
  }
  if (record.aliases?.length) {
    score += Math.min(record.aliases.length, 5) * 0.1;
  }
  return score;
}

function recordQuality(record) {
  return (record.population || 0) * 100 + recordMetadataScore(record);
}

function preferredRecord(existing, incoming) {
  const incomingScore = recordQuality(incoming);
  const existingScore = recordQuality(existing);
  if (incomingScore > existingScore) {
    return incoming;
  }
  if (existingScore > incomingScore) {
    return existing;
  }
  if ((incoming.name || "").length > (existing.name || "").length) {
    return incoming;
  }
  return existing;
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function mergeRecord(existing, incoming) {
  const primary = preferredRecord(existing, incoming);
  const secondary = primary === existing ? incoming : existing;

  return {
    ...secondary,
    ...primary,
    aliases: uniqueValues([...(existing.aliases || []), ...(incoming.aliases || [])]),
    normalizedVariants: uniqueValues([...(existing.normalizedVariants || []), ...(incoming.normalizedVariants || [])]),
    country: primary.country || secondary.country || null,
    state: primary.state || secondary.state || null,
    district: primary.district || secondary.district || null,
    asciiName: primary.asciiName || secondary.asciiName || null,
    latitude: primary.latitude ?? secondary.latitude ?? null,
    longitude: primary.longitude ?? secondary.longitude ?? null,
    population: primary.population ?? secondary.population ?? null,
    timezone: primary.timezone || secondary.timezone || null
  };
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const qualityDelta = recordQuality(right) - recordQuality(left);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

function buildLookup(entries) {
  const lookup = new Map();
  for (const entry of entries) {
    for (const variant of entry.normalizedVariants || []) {
      if (variant && !lookup.has(variant)) {
        lookup.set(variant, entry);
      }
    }
  }
  return lookup;
}

function buildStartingLetterIndex(entries) {
  const index = new Map();
  for (const entry of entries) {
    if (!entry.startingLetter) {
      continue;
    }
    if (!index.has(entry.startingLetter)) {
      index.set(entry.startingLetter, []);
    }
    index.get(entry.startingLetter).push(entry);
  }
  return index;
}

function buildNormalizedNameIndex(entries) {
  return new Map(entries.map((entry) => [entry.normalizedName, entry]));
}

export function buildAtlasDataset(entries, metadata = {}) {
  const dedupedByCategory = new Map();
  let duplicateRows = 0;

  for (const entry of entries || []) {
    if (!entry?.normalizedName || !entry?.category) {
      continue;
    }
    const dedupeKey = `${entry.category}:${entry.normalizedName}`;
    if (dedupedByCategory.has(dedupeKey)) {
      duplicateRows += 1;
      dedupedByCategory.set(dedupeKey, mergeRecord(dedupedByCategory.get(dedupeKey), entry));
      continue;
    }
    dedupedByCategory.set(dedupeKey, entry);
  }

  const byCategory = {
    [ATLAS_CATEGORY_WORLD_CITIES]: [],
    [ATLAS_CATEGORY_INDIA_DISTRICTS]: [],
    [ATLAS_CATEGORY_INDIA_SUBDISTRICTS]: []
  };

  for (const entry of dedupedByCategory.values()) {
    if (byCategory[entry.category]) {
      byCategory[entry.category].push(entry);
    }
  }

  for (const category of ATLAS_RECORD_CATEGORIES) {
    byCategory[category] = sortRecords(byCategory[category]);
  }

  const mixed = ATLAS_RECORD_CATEGORIES.flatMap((category) => byCategory[category]);
  const recordsByCategory = {
    ...byCategory,
    [ATLAS_CATEGORY_MIXED]: mixed
  };

  const lookupByCategory = Object.fromEntries(
    Object.entries(recordsByCategory).map(([category, records]) => [category, buildLookup(records)])
  );

  const recordsByStartingLetter = Object.fromEntries(
    Object.entries(recordsByCategory).map(([category, records]) => [category, buildStartingLetterIndex(records)])
  );

  const recordsByNormalizedName = Object.fromEntries(
    Object.entries(recordsByCategory).map(([category, records]) => [category, buildNormalizedNameIndex(records)])
  );

  const invalidRows = metadata.invalidRows || 0;
  const extraSkippedRows = metadata.extraSkippedRows || 0;
  const skippedRows = invalidRows + duplicateRows + extraSkippedRows;

  return {
    source: metadata.source || metadata.directory || "injected",
    directory: metadata.directory || null,
    directoryName: metadata.directoryName || null,
    files: { ...(metadata.files || {}) },
    loadedFiles: [...(metadata.loadedFiles || [])],
    byCategory: recordsByCategory,
    recordsByCategory,
    lookupByCategory,
    recordsByStartingLetter,
    startingLetterIndexByCategory: recordsByStartingLetter,
    recordsByNormalizedName,
    normalizedNameIndexByCategory: recordsByNormalizedName,
    masterPool: mixed,
    summary: {
      directory: metadata.directory || null,
      directoryName: metadata.directoryName || null,
      source: metadata.source || metadata.directory || "injected",
      totalRecordsLoaded: mixed.length,
      worldCitiesCount: recordsByCategory[ATLAS_CATEGORY_WORLD_CITIES].length,
      indiaDistrictsCount: recordsByCategory[ATLAS_CATEGORY_INDIA_DISTRICTS].length,
      indiaSubdistrictsCount: recordsByCategory[ATLAS_CATEGORY_INDIA_SUBDISTRICTS].length,
      mixedCount: mixed.length,
      invalidRows,
      duplicateRows,
      skippedRows,
      rawCountsByCategory: { ...(metadata.rawCountsByCategory || {}) },
      masterFileRows: metadata.masterFileRows || 0,
      loadedFiles: [...(metadata.loadedFiles || [])]
    }
  };
}
