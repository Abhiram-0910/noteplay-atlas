export const ATLAS_CATEGORY_WORLD_CITIES = "world_cities";
export const ATLAS_CATEGORY_INDIA_DISTRICTS = "india_districts";
export const ATLAS_CATEGORY_INDIA_SUBDISTRICTS = "india_subdistricts";
export const ATLAS_CATEGORY_MIXED = "mixed";

export const ATLAS_RECORD_CATEGORIES = [
  ATLAS_CATEGORY_WORLD_CITIES,
  ATLAS_CATEGORY_INDIA_DISTRICTS,
  ATLAS_CATEGORY_INDIA_SUBDISTRICTS
];

export const ATLAS_CATEGORIES = [...ATLAS_RECORD_CATEGORIES, ATLAS_CATEGORY_MIXED];

export const ATLAS_CATEGORY_LABELS = {
  [ATLAS_CATEGORY_WORLD_CITIES]: "World Cities",
  [ATLAS_CATEGORY_INDIA_DISTRICTS]: "India Districts",
  [ATLAS_CATEGORY_INDIA_SUBDISTRICTS]: "India Subdistricts",
  [ATLAS_CATEGORY_MIXED]: "Mixed"
};

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

export function cleanAtlasDisplayName(value) {
  return cleanText(value)
    .replaceAll("â€™", "'")
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function asciiFold(value) {
  return cleanAtlasDisplayName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAtlasLookup(value) {
  return asciiFold(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function atlasStartingLetter(value) {
  const letters = asciiFold(value).match(/[A-Za-z]/);
  return letters ? letters[0].toUpperCase() : "";
}

export function atlasEndingLetter(value) {
  const letters = asciiFold(value).match(/[A-Za-z]/g);
  return letters && letters.length > 0 ? letters[letters.length - 1].toUpperCase() : "";
}

function normalizeCategoryToken(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function categoryFromToken(token, allowLegacyMixed = false) {
  if (!token) {
    return null;
  }

  if ([
    ATLAS_CATEGORY_WORLD_CITIES,
    "world_city",
    "worldcities",
    "worldcity",
    "city",
    "cities",
    "cities500",
    "capital",
    "capitals",
    "populated_place",
    "populated_places",
    "p"
  ].includes(token)) {
    return ATLAS_CATEGORY_WORLD_CITIES;
  }

  if ([
    ATLAS_CATEGORY_INDIA_DISTRICTS,
    "india_district",
    "district",
    "districts",
    "adm2"
  ].includes(token)) {
    return ATLAS_CATEGORY_INDIA_DISTRICTS;
  }

  if ([
    ATLAS_CATEGORY_INDIA_SUBDISTRICTS,
    "india_subdistrict",
    "subdistrict",
    "subdistricts",
    "mandal",
    "mandals",
    "tehsil",
    "tehsils",
    "taluk",
    "taluks",
    "taluka",
    "talukas",
    "block",
    "blocks",
    "adm4"
  ].includes(token)) {
    return ATLAS_CATEGORY_INDIA_SUBDISTRICTS;
  }

  if ([
    ATLAS_CATEGORY_MIXED,
    "all"
  ].includes(token)) {
    return ATLAS_CATEGORY_MIXED;
  }

  if (allowLegacyMixed && ["places", "place", "geography", "countries", "country"].includes(token)) {
    return ATLAS_CATEGORY_MIXED;
  }

  return null;
}

export function normalizeAtlasCategory(value, fallback = ATLAS_CATEGORY_MIXED) {
  return categoryFromToken(normalizeCategoryToken(value), true) || fallback;
}

export function normalizeAtlasRecordCategory(value, fallback = null) {
  return categoryFromToken(normalizeCategoryToken(value), false) || fallback;
}

function normalizeRecordKeys(record) {
  return Object.fromEntries(
    Object.entries(record || {}).map(([key, value]) => [String(key).trim().toLowerCase(), value])
  );
}

function firstValue(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && cleanText(value)) {
      return value;
    }
  }
  return "";
}

function splitAliasValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitAliasValues(entry));
  }
  const text = cleanAtlasDisplayName(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[|;]+/g)
    .map((entry) => cleanAtlasDisplayName(entry))
    .filter(Boolean);
}

function parseInteger(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFloatValue(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedAliases(normalizedRecord, name) {
  const aliases = [
    ...splitAliasValues(firstValue(normalizedRecord, ["aliases", "alias", "alternate_names", "alternate_name", "alts", "synonyms"])),
    cleanAtlasDisplayName(firstValue(normalizedRecord, ["ascii_name", "asciiname", "ascii"]))
  ].filter(Boolean);

  const canonicalNameKey = normalizeAtlasLookup(name);
  const dedupe = new Set();
  const cleaned = [];
  for (const alias of aliases) {
    const normalizedAlias = normalizeAtlasLookup(alias);
    if (!normalizedAlias || normalizedAlias === canonicalNameKey || dedupe.has(normalizedAlias)) {
      continue;
    }
    dedupe.add(normalizedAlias);
    cleaned.push(alias);
  }
  return cleaned;
}

export function normalizeAtlasRecord(record, {
  index = 0,
  sourceName = "atlas",
  fallbackCategory = null,
  enforceCategory = false
} = {}) {
  const normalizedRecord = normalizeRecordKeys(record);
  const name = cleanAtlasDisplayName(firstValue(normalizedRecord, [
    "name",
    "place",
    "city",
    "district",
    "subdistrict",
    "title"
  ]));

  if (!name) {
    return null;
  }

  const rawCategory = firstValue(normalizedRecord, ["category", "type", "kind", "record_type", "recordtype"]);
  const normalizedFallbackCategory = normalizeAtlasRecordCategory(fallbackCategory, fallbackCategory);
  const category = normalizeAtlasRecordCategory(rawCategory, normalizedFallbackCategory);
  if (!category || category === ATLAS_CATEGORY_MIXED) {
    return null;
  }
  if (enforceCategory && normalizedFallbackCategory && category !== normalizedFallbackCategory) {
    return null;
  }

  const normalizedName = normalizeAtlasLookup(name);
  const startingLetter = atlasStartingLetter(name);
  const endingLetter = atlasEndingLetter(name);
  if (!normalizedName || !startingLetter || !endingLetter) {
    return null;
  }

  const aliases = normalizedAliases(normalizedRecord, name);
  const normalizedVariants = [...new Set([
    normalizedName,
    ...aliases.map((alias) => normalizeAtlasLookup(alias)).filter(Boolean)
  ])];

  return {
    id: cleanAtlasDisplayName(firstValue(normalizedRecord, ["id", "atlas_id", "place_id"])) || `${sourceName}-${index + 1}`,
    name,
    category,
    rawCategory: cleanAtlasDisplayName(rawCategory) || normalizedFallbackCategory || null,
    country: cleanAtlasDisplayName(firstValue(normalizedRecord, ["country", "country_name", "nation"])) || (category === ATLAS_CATEGORY_WORLD_CITIES ? null : "India"),
    state: cleanAtlasDisplayName(firstValue(normalizedRecord, ["state", "admin1", "region", "province"])) || null,
    district: cleanAtlasDisplayName(firstValue(normalizedRecord, ["district", "admin2"])) || null,
    aliases,
    normalizedName,
    normalizedVariants,
    startingLetter,
    endingLetter,
    asciiName: cleanAtlasDisplayName(firstValue(normalizedRecord, ["ascii_name", "asciiname", "ascii"])) || null,
    latitude: parseFloatValue(firstValue(normalizedRecord, ["latitude", "lat"])),
    longitude: parseFloatValue(firstValue(normalizedRecord, ["longitude", "lon", "lng"])),
    population: parseInteger(firstValue(normalizedRecord, ["population", "pop"])),
    timezone: cleanAtlasDisplayName(firstValue(normalizedRecord, ["timezone", "tz"])) || null
  };
}
