const FORMULA_VARIANT_LABELS = new Set([
  "minor",
  "lesser",
  "moderate",
  "greater",
  "major",
  "true",
  "standard",
  "expanded",
  "advanced",
]);

export function getFormulaRecipeKey(item) {
  const name = String(item?.name || "").trim().replace(/\s+/g, " ");
  const variantMatch = name.match(/^(.*?)\s+\(([^)]+)\)$/);
  if (!variantMatch) return name.toLowerCase();

  const variantLabel = variantMatch[2].trim().toLowerCase();
  if (!FORMULA_VARIANT_LABELS.has(variantLabel)) return name.toLowerCase();
  return variantMatch[1].trim().toLowerCase();
}

export function filterHighestLevelFormulaItems(items = [], highestLevelOnly = false) {
  if (!highestLevelOnly) return items;

  const bestByRecipe = new Map();
  items.forEach((item, index) => {
    const key = getFormulaRecipeKey(item);
    const level = Number(item?.level) || 0;
    const current = bestByRecipe.get(key);
    if (!current) {
      bestByRecipe.set(key, { item, level, firstIndex: index });
      return;
    }
    if (level > current.level) {
      bestByRecipe.set(key, { item, level, firstIndex: current.firstIndex });
    }
  });

  return [...bestByRecipe.values()]
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .map((entry) => entry.item);
}

export function getFormulaItemType(item) {
  return (item?.type || item?.category || "").trim();
}

export function filterFormulaItemsByType(items = [], typeFilter = "all") {
  if (typeFilter === "all") return items;
  return items.filter((item) => getFormulaItemType(item) === typeFilter);
}
