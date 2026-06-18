import { markDeleted, markRestored } from "./campaignReducers.js";
import { cloneValue, createInstanceId } from "./inventoryReducers.js";

export function createMapRecord(nameOrMap, options = {}) {
  const { createId = () => createInstanceId("map"), order = Date.now() } = options;
  const base = typeof nameOrMap === "string" ? { name: nameOrMap } : cloneValue(nameOrMap) || {};
  const map = normalizeMap(
    {
      id: base.id || createId("map"),
      name: base.name || "New Map",
      imageUrl: "",
      visibleToPlayers: false,
      order,
      scale: null,
      pins: [],
      ...base,
    },
    options
  );
  delete map.deletedAt;
  delete map.deletedBy;
  return map;
}

export function normalizeMap(map = {}, options = {}) {
  const { createPinId = () => createInstanceId("pin") } = options;
  const next = cloneValue(map) || {};
  next.id = next.id || createInstanceId("map");
  next.name = next.name || "New Map";
  next.imageUrl = next.imageUrl || "";
  next.visibleToPlayers = Boolean(next.visibleToPlayers);
  next.order = Number.isFinite(Number(next.order)) ? Number(next.order) : Date.now();
  next.scale = next.scale || null;
  next.pins = Array.isArray(next.pins)
    ? next.pins.map((pin) => normalizePin(pin, { createId: createPinId }))
    : [];
  return next;
}

export function normalizePin(pin = {}, options = {}) {
  const { createId = () => createInstanceId("pin") } = options;
  return {
    ...cloneValue(pin),
    id: pin.id || createId("pin"),
    x: Number(pin.x) || 0,
    y: Number(pin.y) || 0,
    visibleToPlayers: Boolean(pin.visibleToPlayers),
  };
}

export function sortMapsForView(maps = []) {
  return [...(maps || [])].sort(sortByOrderNameId);
}

export function applyMapUpdate(map, updater, options = {}) {
  const current = normalizeMap(map, options);
  const result = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  return normalizeMap(result || current, options);
}

export function upsertMapInCampaign(campaign, map, options = {}) {
  const next = normalizeCampaignMaps(campaign, options);
  const normalizedMap = createMapRecord(map, options);
  const index = next.maps.findIndex((entry) => entry.id === normalizedMap.id);
  if (index >= 0) next.maps[index] = normalizedMap;
  else next.maps.push(normalizedMap);
  next.maps = normalizeMapOrder(next.maps);
  return next;
}

export function updateMapInCampaign(campaign, mapId, updater, options = {}) {
  const next = normalizeCampaignMaps(campaign, options);
  const index = next.maps.findIndex((map) => map.id === mapId);
  if (index < 0) return next;
  next.maps[index] = applyMapUpdate(next.maps[index], updater, options);
  next.maps = normalizeMapOrder(next.maps);
  return next;
}

export function softDeleteMapInCampaign(campaign, mapId, options = {}) {
  return updateMapInCampaign(campaign, mapId, (map) => markDeleted({ ...map, visibleToPlayers: false }, options), options);
}

export function restoreMapInCampaign(campaign, mapId, options = {}) {
  return updateMapInCampaign(campaign, mapId, (map) => markRestored(map, options), options);
}

export function reorderMapsInCampaign(campaign, orderedIds = []) {
  const next = normalizeCampaignMaps(campaign);
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  next.maps = next.maps.map((map) => (
    orderById.has(map.id) ? { ...map, order: (orderById.get(map.id) + 1) * 1000 } : map
  ));
  return next;
}

export function setMapImageUrlInCampaign(campaign, mapId, imageUrl) {
  return updateMapInCampaign(campaign, mapId, { imageUrl: imageUrl || "" });
}

export function upsertMapPinInCampaign(campaign, mapId, pin, options = {}) {
  return updateMapInCampaign(campaign, mapId, (map) => {
    const normalizedPin = normalizePin(pin, { createId: options.createId || (() => createInstanceId("pin")) });
    const pins = Array.isArray(map.pins) ? [...map.pins] : [];
    const index = pins.findIndex((entry) => entry.id === normalizedPin.id);
    if (index >= 0) pins[index] = normalizedPin;
    else pins.push(normalizedPin);
    return { ...map, pins };
  }, options);
}

export function deleteMapPinInCampaign(campaign, mapId, pinId) {
  return updateMapInCampaign(campaign, mapId, (map) => ({
    ...map,
    pins: (map.pins || []).filter((pin) => pin.id !== pinId),
  }));
}

export function setMapScaleInCampaign(campaign, mapId, scale) {
  return updateMapInCampaign(campaign, mapId, { scale: scale || null });
}

export function normalizeMapOrder(maps = []) {
  return sortMapsForView(maps).map((map, index) => ({
    ...map,
    order: Number.isFinite(Number(map.order)) ? Number(map.order) : (index + 1) * 1000,
  }));
}

function normalizeCampaignMaps(campaign, options = {}) {
  const next = cloneValue(campaign) || {};
  next.maps = Array.isArray(next.maps) ? next.maps.map((map) => normalizeMap(map, options)) : [];
  return next;
}

function sortByOrderNameId(a, b) {
  const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
  return orderA - orderB
    || String(a?.name || "").localeCompare(String(b?.name || ""))
    || String(a?.id || "").localeCompare(String(b?.id || ""));
}
