import { applyActorUpdate } from "./actorReducers.js";
import { normalizeEmail } from "./campaignReducers.js";
import { applyCharacterUpdate, cloneValue, createInstanceId } from "./inventoryReducers.js";

export function createActionContext({
  db,
  setDb,
  mode = "legacy",
  firestore = null,
  createId = () => createInstanceId("item"),
  actorEmail = null,
  repositories = {},
} = {}) {
  const useFirestoreV2 = mode === "firestore-v2" && hasFirestoreConfig(firestore);
  const repos = repositories;
  const actor = normalizeEmail(actorEmail);

  const nowIso = () => new Date().toISOString();
  const createDomainId = (prefix) => {
    if (typeof createId === "function" && createId.length > 0) return createId(prefix);
    return createInstanceId(prefix);
  };

  const updateDbLegacy = (updater) => {
    if (!setDb) return Promise.resolve();
    setDb((prev) => (typeof updater === "function" ? updater(prev) : { ...prev, ...updater }));
    return Promise.resolve();
  };

  const updateCampaignLegacy = (campaignId, updater) => {
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev);
      const targetCampaignId = campaignId || next?.activeCampaignId;
      const currentCampaign = next?.campaigns?.[targetCampaignId];
      if (!currentCampaign) return prev;
      next.campaigns[targetCampaignId] =
        typeof updater === "function" ? updater(currentCampaign) : { ...currentCampaign, ...updater };
      return next;
    });
  };

  const updateCharacterLegacy = (campaignId, characterId, updater) =>
    updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];
      const index = next.characters.findIndex((char) => char.id === characterId);
      if (index < 0) return next;
      next.characters[index] = applyCharacterUpdate(next.characters[index], updater, { createId });
      return next;
    });

  const actorDocToCharacter = (actorDoc, actorId) => ({
    ...(actorDoc?.sheet || {}),
    id: actorDoc?.sheet?.id || actorDoc?.id || actorId,
    name: actorDoc?.sheet?.name || actorDoc?.name,
    level: actorDoc?.sheet?.level ?? actorDoc?.level,
    stats: actorDoc?.stats || actorDoc?.sheet?.stats,
    inventory: actorDoc?.inventory || actorDoc?.sheet?.inventory,
    magic: actorDoc?.magic || actorDoc?.sheet?.magic,
  });

  const characterToPcActorDoc = (actorDoc, character, campaignId, actorId) =>
    applyActorUpdate({
      ...actorDoc,
      id: actorDoc?.id || actorId,
      kind: actorDoc?.kind || "pc",
      name: character.name || actorDoc?.name,
      level: character.level ?? actorDoc?.level,
      stats: character.stats,
      inventory: character.inventory,
      magic: character.magic,
      sheet: {
        ...(actorDoc?.sheet || {}),
        ...character,
        id: character.id || actorDoc?.sheet?.id || actorDoc?.id || actorId,
        stats: character.stats,
        inventory: character.inventory,
        magic: character.magic,
      },
    }, {
      createId: () => createDomainId("actor"),
      campaignId,
    });

  const updatePcActorAsCharacter = (campaignId, actorId, updater) => {
    if (useFirestoreV2) {
      return repos.actorRepo.updateActor(firestore, campaignId, actorId, (actorDoc) => {
        const currentCharacter = actorDocToCharacter(actorDoc, actorId);
        const nextCharacter = applyCharacterUpdate(currentCharacter, updater, { createId });
        return characterToPcActorDoc(actorDoc, nextCharacter, campaignId, actorId);
      });
    }
    return updateCharacterLegacy(campaignId, actorId, updater);
  };

  const updateCharacter = (campaignId, characterId, updater) => {
    if (useFirestoreV2) {
      return updatePcActorAsCharacter(campaignId, characterId, updater);
    }
    return updateCharacterLegacy(campaignId, characterId, updater);
  };

  const updateActorLegacy = (campaignId, actorId, updater) =>
    updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.actors = Array.isArray(next.actors) ? next.actors.map((item) => cloneValue(item)) : [];
      const index = next.actors.findIndex((item) => item.id === actorId);
      if (index < 0) return next;
      next.actors[index] = applyActorUpdate(next.actors[index], updater, {
        createId: () => createDomainId("actor"),
        campaignId,
      });
      return next;
    });

  return {
    actor,
    actorDocToCharacter,
    characterToPcActorDoc,
    createDomainId,
    createId,
    db,
    firestore,
    mode: useFirestoreV2 ? "firestore-v2" : "legacy",
    nowIso,
    repos,
    updateActorLegacy,
    updateCampaignLegacy,
    updateCharacter,
    updateCharacterLegacy,
    updateDbLegacy,
    updatePcActorAsCharacter,
    useFirestoreV2,
  };
}

export function hasFirestoreConfig(firestore) {
  return Boolean(firestore?.app?.options?.projectId);
}
