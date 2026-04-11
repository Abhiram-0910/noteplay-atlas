export const ATLAS_CATEGORY_OPTIONS = [
  {
    id: "world_cities",
    label: "World Cities",
    description: "GeoNames populated places"
  },
  {
    id: "india_districts",
    label: "India Districts",
    description: "District-level Atlas pool"
  },
  {
    id: "india_subdistricts",
    label: "India Subdistricts",
    description: "Mandal / tehsil / taluk-like pool"
  },
  {
    id: "mixed",
    label: "Mixed",
    description: "World cities plus India admin layers"
  }
];

export const ATLAS_CATEGORY_LABELS = Object.fromEntries(
  ATLAS_CATEGORY_OPTIONS.map((option) => [option.id, option.label])
);

export const ATLAS_MODE_LABEL = "Lives";
