import { markDeleted, markRestored } from "./campaignReducers.js";
import { cloneValue, createInstanceId } from "./inventoryReducers.js";

export function getCamping(campaignOrCamping) {
  const source = campaignOrCamping?.camping || campaignOrCamping || {};
  return {
    zoneDC: source.zoneDC ?? null,
    encounterDC: source.encounterDC ?? null,
    foragingDC: source.foragingDC ?? null,
    activities: Array.isArray(source.activities) ? source.activities.map((activity) => cloneValue(activity)) : [],
    assignments: source.assignments && typeof source.assignments === "object" ? cloneValue(source.assignments) : {},
  };
}

export function updateCampingInCampaign(campaign, patchOrUpdater) {
  const next = cloneValue(campaign) || {};
  const currentCamping = getCamping(next);
  const updatedCamping = typeof patchOrUpdater === "function"
    ? patchOrUpdater(currentCamping)
    : { ...currentCamping, ...cloneValue(patchOrUpdater) };
  next.camping = getCamping(updatedCamping);
  return next;
}

export function upsertCampingActivityInCampaign(campaign, activity, options = {}) {
  const { createId = () => createInstanceId("camping_activity") } = options;
  const normalized = normalizeCampingActivity(activity, { createId });
  return updateCampingInCampaign(campaign, (camping) => {
    const activities = [...camping.activities];
    const index = activities.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) activities[index] = { ...activities[index], ...normalized };
    else activities.push(normalized);
    return { ...camping, activities };
  });
}

export function softDeleteCampingActivityInCampaign(campaign, activityId, options = {}) {
  return updateCampingInCampaign(campaign, (camping) => {
    const activities = camping.activities.map((activity) =>
      activity.id === activityId ? markDeleted(activity, options) : activity
    );
    const assignments = { ...(camping.assignments || {}) };
    delete assignments[activityId];
    return { ...camping, activities, assignments };
  });
}

export function restoreCampingActivityInCampaign(campaign, activityId, options = {}) {
  return updateCampingInCampaign(campaign, (camping) => ({
    ...camping,
    activities: camping.activities.map((activity) =>
      activity.id === activityId ? markRestored(activity, options) : activity
    ),
  }));
}

export function resetDefaultCampingActivityInCampaign(campaign, activityId) {
  return updateCampingInCampaign(campaign, (camping) => {
    const activities = camping.activities.filter((activity) => activity.id !== activityId);
    return { ...camping, activities };
  });
}

export function assignCampingActivityInCampaign(campaign, activityId, character, options = {}) {
  return updateCampingInCampaign(campaign, (camping) => {
    const assignments = { ...(camping.assignments || {}) };
    const existing = assignments[activityId];
    const characterId = character?.id || null;
    const characterName = character?.name || existing?.characterName || "Unknown";

    if (existing?.characterName && !sameAssignmentOwner(existing, characterId, characterName) && !options.force) {
      throw new Error(`Camping activity is already assigned to ${existing.characterName}.`);
    }

    assignments[activityId] = {
      ...(existing || {}),
      characterId,
      characterName,
      roll: null,
      result: null,
      degree: null,
      effectText: null,
      assignedAt: options.now || new Date().toISOString(),
      assignedBy: options.actorEmail || null,
    };
    return { ...camping, assignments };
  });
}

export function recordCampingActivityRollInCampaign(campaign, activityId, character, rollResult, options = {}) {
  return updateCampingInCampaign(campaign, (camping) => {
    const assignments = { ...(camping.assignments || {}) };
    const existing = assignments[activityId] || {};
    const characterId = character?.id || existing.characterId || null;
    const characterName = character?.name || existing.characterName || "Unknown";

    if (existing?.characterName && character && !sameAssignmentOwner(existing, characterId, characterName)) {
      throw new Error(`Camping activity is assigned to ${existing.characterName}.`);
    }

    assignments[activityId] = {
      ...existing,
      characterId,
      characterName,
      roll: Number(rollResult?.roll) || 0,
      degree: rollResult?.degree || null,
      result: rollResult?.result || null,
      effectText: rollResult?.effectText || null,
      rolledAt: options.now || new Date().toISOString(),
      rolledBy: options.actorEmail || null,
    };
    return { ...camping, assignments };
  });
}

export function unassignCampingActivityInCampaign(campaign, activityId, character = null) {
  return updateCampingInCampaign(campaign, (camping) => {
    const assignments = { ...(camping.assignments || {}) };
    const existing = assignments[activityId];
    if (!existing) return camping;

    const characterId = character?.id || null;
    const characterName = character?.name || null;
    if (character && !sameAssignmentOwner(existing, characterId, characterName)) {
      throw new Error(`Camping activity is assigned to ${existing.characterName || "another character"}.`);
    }

    delete assignments[activityId];
    return { ...camping, assignments };
  });
}

export function normalizeCampingActivity(activity = {}, options = {}) {
  const { createId = () => createInstanceId("camping_activity") } = options;
  return {
    ...cloneValue(activity),
    id: activity.id || createId("camping_activity"),
    name: activity.name || "New Activity",
    skills: Array.isArray(activity.skills) ? activity.skills : [],
    dcType: activity.dcType || "zone",
    customDC: activity.customDC ?? null,
  };
}

function sameAssignmentOwner(assignment, characterId, characterName) {
  if (characterId && assignment.characterId) return assignment.characterId === characterId;
  return Boolean(characterName && assignment.characterName === characterName);
}
