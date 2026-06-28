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
    skills: actorDoc?.skills || actorDoc?.sheet?.skills || {},
    inventory: actorDoc?.inventory || actorDoc?.sheet?.inventory,
    magic: actorDoc?.magic || actorDoc?.sheet?.magic,
    formulaBook: actorDoc?.formulaBook || actorDoc?.sheet?.formulaBook || [],
    languages: actorDoc?.languages || actorDoc?.sheet?.languages || [],
    senses: actorDoc?.senses || actorDoc?.sheet?.senses || [],
    proficiencies: actorDoc?.proficiencies || actorDoc?.sheet?.proficiencies || {},
    gold: actorDoc?.gold ?? actorDoc?.sheet?.gold ?? 0,
    xp: actorDoc?.xp || actorDoc?.sheet?.xp,
    dailyCraftingMax: actorDoc?.dailyCraftingMax ?? actorDoc?.sheet?.dailyCraftingMax,
  });

  const characterToPcActorDoc = (actorDoc, character, campaignId, actorId) =>
    applyActorUpdate({
      ...actorDoc,
      id: actorDoc?.id || actorId,
      kind: actorDoc?.kind || "pc",
      name: character.name || actorDoc?.name,
      level: character.level ?? actorDoc?.level,
      stats: character.stats,
      skills: character.skills,
      inventory: character.inventory,
      magic: character.magic,
      formulaBook: character.formulaBook,
      languages: character.languages,
      senses: character.senses,
      proficiencies: character.proficiencies,
      gold: character.gold,
      xp: character.xp,
      dailyCraftingMax: character.dailyCraftingMax,
      sheet: {
        ...(actorDoc?.sheet || {}),
        ...character,
        id: character.id || actorDoc?.sheet?.id || actorDoc?.id || actorId,
        stats: character.stats,
        skills: character.skills,
        inventory: character.inventory,
        magic: character.magic,
        formulaBook: character.formulaBook,
        languages: character.languages,
        senses: character.senses,
        proficiencies: character.proficiencies,
        gold: character.gold,
        xp: character.xp,
        dailyCraftingMax: character.dailyCraftingMax,
      },
    }, (current) => current, {
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
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.actors = Array.isArray(next.actors) ? next.actors.map((item) => cloneValue(item)) : [];
      next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];

      const actorIndex = next.actors.findIndex((item) => item.id === actorId);
      if (actorIndex >= 0) {
        const actorDoc = next.actors[actorIndex];
        const currentCharacter = actorDocToCharacter(actorDoc, actorId);
        const nextCharacter = applyCharacterUpdate(currentCharacter, updater, { createId });
        next.actors[actorIndex] = characterToPcActorDoc(actorDoc, nextCharacter, campaignId, actorId);
        const characterIndex = next.characters.findIndex((char) => char.id === actorId);
        if (characterIndex >= 0) next.characters[characterIndex] = nextCharacter;
        return next;
      }

      const characterIndex = next.characters.findIndex((char) => char.id === actorId);
      if (characterIndex < 0) return next;
      next.characters[characterIndex] = applyCharacterUpdate(next.characters[characterIndex], updater, { createId });
      return next;
    });
  };

  const updateCharacter = (campaignId, characterId, updater) => {
    if (useFirestoreV2) {
      return updatePcActorAsCharacter(campaignId, characterId, updater);
    }
    return updatePcActorAsCharacter(campaignId, characterId, updater);
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
    getActivePcActorIds,
    stripChildCollections,
  };
}

export function hasFirestoreConfig(firestore) {
  return Boolean(firestore?.app?.options?.projectId);
}

export function stripChildCollections(campaign) {
  const next = { ...campaign };
  delete next.characters;
  delete next.archivedCharacters;
  delete next.quests;
  delete next.archivedQuests;
  delete next.lootBags;
  delete next.encounters;
  delete next.archivedEncounters;
  delete next.maps;
  return next;
}

export function getActivePcActorIds(campaign) {
  const actors = Array.isArray(campaign?.actors) ? campaign.actors : [];
  if (actors.length) {
    return actors
      .filter((actor) => actor?.kind === "pc" && !actor?.deletedAt)
      .map((actor) => actor.id)
      .filter(Boolean);
  }
  return (campaign?.characters || [])
    .filter((character) => !character?.deletedAt)
    .map((character) => character.id)
    .filter(Boolean);
}
