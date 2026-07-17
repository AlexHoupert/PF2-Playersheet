import { createCatalogOverrideRecord } from "./actorReducers.js";
import { cloneValue } from "./inventoryReducers.js";

export function createCampaignCatalogEntry(input, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString();
  const record = createCatalogOverrideRecord(input, { createId: options.createId });
  return {
    ...record,
    campaignId: options.campaignId || input?.campaignId || null,
    ownerEmail: normalizeEmail(input?.ownerEmail || input?.createdBy || options.actorEmail),
    origin: input?.origin
      || (record.mode === "override" ? "override" : record.mode === "hide" ? "hide" : record.baseId ? "fork" : "custom"),
    authoredRole: input?.authoredRole || options.role || "player",
    createdAt: input?.createdAt || timestamp,
    createdBy: normalizeEmail(input?.createdBy || options.actorEmail),
    updatedAt: timestamp,
    updatedBy: normalizeEmail(options.actorEmail || input?.updatedBy),
  };
}

export function createCatalogChangeEvent(input, options = {}) {
  const timestamp = options.timestamp || new Date().toISOString();
  return {
    id: input.id || options.createId?.("catalog_event"),
    campaignId: input.campaignId || options.campaignId || null,
    entryId: input.entryId,
    catalogType: input.catalogType || null,
    operation: input.operation || "save",
    actorEmail: normalizeEmail(input.actorEmail || options.actorEmail),
    actorRole: input.actorRole || options.role || "player",
    createdAt: timestamp,
    before: input.before ? cloneValue(input.before) : null,
    after: input.after ? cloneValue(input.after) : null,
  };
}

export function applyCampaignCatalogSave(campaign, entry, event) {
  const next = cloneValue(campaign) || {};
  next.catalogEntries = { ...(next.catalogEntries || {}), [entry.id]: cloneValue(entry) };
  next.catalogChangeEvents = [cloneValue(event), ...(next.catalogChangeEvents || [])];
  return next;
}

export function applyCampaignCatalogDelete(campaign, entryId, event) {
  const next = cloneValue(campaign) || {};
  next.catalogEntries = { ...(next.catalogEntries || {}) };
  delete next.catalogEntries[entryId];
  next.catalogChangeEvents = [cloneValue(event), ...(next.catalogChangeEvents || [])];
  return next;
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
