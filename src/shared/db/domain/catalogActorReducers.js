import { normalizeCharacterRuntimeShape } from "./characterShape.js";
import { addItemToCharacter } from "./inventoryReducers.js";

export const PLAYER_CATALOG_ATTACH_LABELS = {
  item: "Add to my inventory",
  spell: "Add to my spell list",
  feat: "Add to my feats",
  impulse: "Add to my impulses",
  action: "Add to my actions",
};

export function attachCatalogEntryToCharacter(character, input, options = {}) {
  const catalogType = String(input?.catalogType || "").trim();
  const entryId = String(input?.entryId || "").trim();
  const payload = input?.payload && typeof input.payload === "object" ? input.payload : {};
  if (!PLAYER_CATALOG_ATTACH_LABELS[catalogType]) {
    throw new Error(`Unsupported player catalog type: ${catalogType || "unknown"}`);
  }
  if (!entryId) throw new Error("A catalog entry id is required");

  const sourceRecord = {
    ...payload,
    catalogEntryId: entryId,
    catalogOverrideId: entryId,
    isCustom: true,
  };

  if (catalogType === "item") {
    return addItemToCharacter(character, sourceRecord, {
      createId: options.createId,
      qty: 1,
      stack: false,
    });
  }

  const next = normalizeCharacterRuntimeShape(character);
  if (catalogType === "spell") {
    const spell = {
      ...sourceRecord,
      level: String(Number.isFinite(Number(payload.level)) ? Number(payload.level) : 1),
    };
    if (!containsCatalogEntry(next.magic.list, sourceRecord)) next.magic.list.push(spell);
    return next;
  }

  if (catalogType === "feat") {
    if (!containsCatalogEntry(next.feats, sourceRecord)) next.feats.push(sourceRecord);
    return next;
  }

  if (catalogType === "impulse") {
    if (!containsCatalogEntry(next.impulses, sourceRecord)) next.impulses.push(sourceRecord);
    return next;
  }

  if (!containsCatalogEntry(next.actions, sourceRecord)) next.actions.push(sourceRecord);
  return next;
}

function containsCatalogEntry(records = [], candidate) {
  return records.some(record => {
    if (typeof record === "string") return record === candidate.name;
    return record?.catalogEntryId === candidate.catalogEntryId
      || record?.catalogOverrideId === candidate.catalogOverrideId
      || (candidate.name && record?.name === candidate.name);
  });
}
