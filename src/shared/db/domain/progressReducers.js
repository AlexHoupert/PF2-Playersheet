import { isSoftDeleted, markDeleted, markRestored } from "./campaignReducers.js";
import { cloneValue } from "./inventoryReducers.js";

const SECTION_LIST_KEYS = {
  reputation: "factions",
  research: "topics",
  calcifer: "stages",
  materials: "elements",
};

export function getProgress(campaignOrProgress, options = {}) {
  const source = campaignOrProgress?.progress || campaignOrProgress || {};
  const progress = {
    reputation: { factions: [], ...(source.reputation || {}) },
    research: { topics: [], ...(source.research || {}) },
    calcifer: { currentProgress: 0, stages: [], ...(source.calcifer || {}) },
    materials: { elements: [], ...(source.materials || {}) },
  };

  Object.entries(SECTION_LIST_KEYS).forEach(([section, listKey]) => {
    progress[section][listKey] = Array.isArray(progress[section][listKey])
      ? progress[section][listKey].map((entry) => cloneValue(entry))
      : [];
  });

  return options.activeOnly ? filterActiveProgress(progress) : progress;
}

export function filterActiveProgress(progress) {
  const next = cloneValue(getProgress(progress)) || {};
  Object.entries(SECTION_LIST_KEYS).forEach(([section, listKey]) => {
    next[section][listKey] = (next[section][listKey] || []).filter((entry) => !isSoftDeleted(entry));
  });
  return next;
}

export function splitProgressEntries(progress, section) {
  const normalized = getProgress(progress);
  const listKey = SECTION_LIST_KEYS[section];
  const entries = listKey ? normalized[section][listKey] || [] : [];
  return {
    active: entries.filter((entry) => !isSoftDeleted(entry)),
    archived: entries.filter((entry) => isSoftDeleted(entry)),
  };
}

export function updateProgressInCampaign(campaign, patchOrUpdater) {
  const next = cloneValue(campaign) || {};
  const currentProgress = getProgress(next);
  const updatedProgress = typeof patchOrUpdater === "function"
    ? patchOrUpdater(currentProgress)
    : { ...currentProgress, ...cloneValue(patchOrUpdater) };
  next.progress = getProgress(updatedProgress);
  return next;
}

export function softDeleteProgressEntryInCampaign(campaign, section, entryId, options = {}) {
  return updateProgressEntryInCampaign(campaign, section, entryId, (entry) => markDeleted(entry, options));
}

export function restoreProgressEntryInCampaign(campaign, section, entryId, options = {}) {
  return updateProgressEntryInCampaign(campaign, section, entryId, (entry) => markRestored(entry, options));
}

export function updateProgressEntryInCampaign(campaign, section, entryId, updater) {
  const listKey = SECTION_LIST_KEYS[section];
  if (!listKey) return cloneValue(campaign) || {};

  return updateProgressInCampaign(campaign, (progress) => {
    const list = Array.isArray(progress[section]?.[listKey]) ? [...progress[section][listKey]] : [];
    const index = list.findIndex((entry) => entry.id === entryId);
    if (index >= 0) {
      list[index] = typeof updater === "function" ? updater(list[index]) : { ...list[index], ...updater };
    }
    return {
      ...progress,
      [section]: {
        ...progress[section],
        [listKey]: list,
      },
    };
  });
}
