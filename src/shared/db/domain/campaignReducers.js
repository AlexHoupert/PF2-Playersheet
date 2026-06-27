import {
  applyCharacterUpdate,
  cloneValue,
  createInstanceId,
  normalizeCharacterInventory,
} from "./inventoryReducers.js";
import { applyRecordUpdater } from "./updateHelpers.js";

export function isSoftDeleted(record) {
  return Boolean(record?.deletedAt);
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function splitActiveArchived(records = []) {
  return {
    active: records.filter((record) => !isSoftDeleted(record)),
    archived: records.filter((record) => isSoftDeleted(record)),
  };
}

export function createCampaignRecord(name, options = {}) {
  const {
    id = `campaign_${Date.now()}`,
    now = Date.now(),
  } = options;
  return {
    id,
    name,
    characters: [],
    quests: [],
    lootBags: [],
    maps: [],
    encounters: [],
    advancement: {
      xpThreshold: 1000,
    },
    createdAt: now,
  };
}

export function createCharacterRecord(character, options = {}) {
  const { createId = () => createInstanceId("character") } = options;
  const next = normalizeCharacterInventory(
    {
      ...cloneValue(character),
      id: character?.id || createId(character),
    },
    { createId }
  );
  delete next.deletedAt;
  delete next.deletedBy;
  return next;
}

export function applyCampaignUpdate(campaign, updater) {
  const current = cloneValue(campaign) || {};
  return normalizeCampaignAdvancement(applyRecordUpdater(current, updater));
}

export function buildCampaignViewModel(campaign) {
  const next = cloneValue(campaign) || {};
  const characterSplit = splitActiveArchived(next.characters || []);
  const questSplit = splitActiveArchived(next.quests || []);
  const lootBagSplit = splitActiveArchived(next.lootBags || []);
  const encounterSplit = splitActiveArchived(next.encounters || []);
  const mapSplit = splitActiveArchived(next.maps || []);
  next.characters = characterSplit.active;
  next.archivedCharacters = characterSplit.archived;
  next.quests = questSplit.active;
  next.archivedQuests = questSplit.archived;
  next.lootBags = lootBagSplit.active;
  next.archivedLootBags = lootBagSplit.archived;
  next.encounters = encounterSplit.active;
  next.archivedEncounters = encounterSplit.archived;
  next.maps = mapSplit.active;
  next.archivedMaps = mapSplit.archived;
  return next;
}

export function createCampaignInDb(db, campaign, options = {}) {
  const next = cloneValue(db) || {};
  const { campaignId = campaign.id || `campaign_${Date.now()}` } = options;
  next.campaigns = { ...(next.campaigns || {}) };
  next.campaigns[campaignId] = {
    ...createCampaignRecord(campaign.name || "New Campaign", {
      id: campaignId,
      now: campaign.createdAt || Date.now(),
    }),
    ...cloneValue(campaign),
    id: campaignId,
  };
  return next;
}

export function softDeleteCampaignInDb(db, campaignId, options = {}) {
  const next = cloneValue(db) || {};
  const campaign = next.campaigns?.[campaignId];
  if (!campaign) return next;
  next.campaigns[campaignId] = markDeleted(campaign, options);
  return next;
}

export function restoreCampaignInDb(db, campaignId, options = {}) {
  const next = cloneValue(db) || {};
  const campaign = next.campaigns?.[campaignId];
  if (!campaign) return next;
  next.campaigns[campaignId] = markRestored(campaign, options);
  return next;
}

export function assignUserInDb(db, email, campaignId, characterId, role = "player") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return cloneValue(db) || {};
  const next = cloneValue(db) || {};
  next.users = { ...(next.users || {}) };
  next.users[normalizedEmail] = {
    role,
    campaignId,
    characterId: characterId || null,
  };
  return next;
}

export function revokeUserInDb(db, email) {
  const normalizedEmail = normalizeEmail(email);
  const next = cloneValue(db) || {};
  next.users = { ...(next.users || {}) };
  delete next.users[normalizedEmail];
  return next;
}

export function createCharacterInCampaign(campaign, character, options = {}) {
  const next = cloneValue(campaign) || {};
  next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];
  next.characters.push(createCharacterRecord(character, options));
  return next;
}

export function softDeleteCharacterInDb(db, campaignId, characterId, options = {}) {
  const next = cloneValue(db) || {};
  const campaign = next.campaigns?.[campaignId];
  if (!campaign) return next;
  next.campaigns[campaignId] = softDeleteCharacterInCampaign(campaign, characterId, options);
  next.users = clearCharacterAssignments(next.users, campaignId, characterId);
  return next;
}

export function softDeleteCharacterInCampaign(campaign, characterId, options = {}) {
  const next = cloneValue(campaign) || {};
  next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];
  const index = next.characters.findIndex((char) => char.id === characterId);
  if (index >= 0) next.characters[index] = markDeleted(next.characters[index], options);
  return next;
}

export function restoreCharacterInCampaign(campaign, characterId, options = {}) {
  const next = cloneValue(campaign) || {};
  next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];
  const index = next.characters.findIndex((char) => char.id === characterId);
  if (index >= 0) next.characters[index] = markRestored(next.characters[index], options);
  return next;
}

export function importLegacyCharacterInDb(db, campaignId, character, legacyIndex, options = {}) {
  const next = cloneValue(db) || {};
  const campaign = next.campaigns?.[campaignId];
  if (!campaign) return next;
  next.campaigns[campaignId] = createCharacterInCampaign(campaign, character, options);
  if (Array.isArray(next.characters)) {
    next.characters = next.characters.filter((_, index) => index !== legacyIndex);
  }
  return next;
}

export function setPartyXpInCampaign(campaign, xp) {
  const next = normalizeCampaignAdvancement(cloneValue(campaign) || {});
  const normalizedXp = Math.max(0, Number(xp) || 0);
  const xpThreshold = getCampaignXpThreshold(next);
  next.xp = normalizedXp;
  next.characters = Array.isArray(next.characters) ? next.characters.map((character) => {
    if (isSoftDeleted(character)) return character;
    const updated = applyCharacterUpdate(character, (char) => {
      char.xp = { ...(char.xp || { max: xpThreshold }), current: normalizedXp, max: xpThreshold };
      return char;
    });
    return updated;
  }) : [];
  return next;
}

export function getCampaignXpThreshold(campaign) {
  const configured = Number(campaign?.advancement?.xpThreshold ?? campaign?.xpThreshold);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1000;
}

export function normalizeCampaignAdvancement(campaign = {}) {
  const next = cloneValue(campaign) || {};
  const xpThreshold = getCampaignXpThreshold(next);
  next.advancement = {
    ...(next.advancement || {}),
    xpThreshold,
  };
  return next;
}

export function addPartyXpInCampaign(campaign, amount, options = {}) {
  const next = setPartyXpInCampaign(campaign, (Number(campaign?.xp) || 0) + (Number(amount) || 0));
  next.xpNotification = {
    id: options.notificationId || Date.now(),
    amount: Number(amount) || 0,
  };
  return next;
}

export function clearCharacterAssignments(users = {}, campaignId, characterId) {
  return Object.fromEntries(
    Object.entries(users || {}).map(([email, info]) => [
      normalizeEmail(email),
      info?.campaignId === campaignId && info?.characterId === characterId
        ? { ...info, characterId: null }
        : info,
    ])
  );
}

export function markDeleted(record, options = {}) {
  const { now = new Date().toISOString(), actorEmail = null } = options;
  return {
    ...cloneValue(record),
    deletedAt: record?.deletedAt || now,
    deletedBy: record?.deletedBy || actorEmail || null,
  };
}

export function markRestored(record, options = {}) {
  const { now = new Date().toISOString(), actorEmail = null } = options;
  const next = {
    ...cloneValue(record),
    restoredAt: now,
    restoredBy: actorEmail || null,
  };
  delete next.deletedAt;
  delete next.deletedBy;
  return next;
}
