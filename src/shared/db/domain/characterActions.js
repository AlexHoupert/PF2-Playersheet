import { createActorRecord } from "./actorReducers.js";
import {
  createCharacterInCampaign,
  createCharacterRecord,
  importLegacyCharacterInDb,
  markDeleted,
  markRestored,
  normalizeEmail,
  restoreCharacterInCampaign,
  softDeleteCharacterInDb,
} from "./campaignReducers.js";
import {
  adjustCharacterAttribute,
  adjustCharacterClassDc,
  adjustCharacterGold,
  adjustCharacterHp,
  adjustCharacterMaxHp,
  adjustCharacterSpeed,
  adjustCharacterTempHp,
  setCharacterAttribute,
  setCharacterClassDc,
  setCharacterDailyCraftingMax,
  setCharacterGold,
  setCharacterHp,
  setCharacterMaxHp,
  setCharacterSpeed,
  setCharacterTempHp,
} from "./characterEditReducers.js";

export function createCharacterActions(context) {
  const {
    actor,
    createId,
    db,
    firestore,
    nowIso,
    repos,
    updateCampaignLegacy,
    updateCharacter,
    updateDbLegacy,
    updatePcActorAsCharacter,
    useFirestoreV2,
  } = context;

  const createCharacter = (campaignId, character) => {
    const normalizedCharacter = createCharacterRecord(character, { createId });
    if (useFirestoreV2) {
      return repos.actorRepo.createActor(firestore, campaignId, createActorRecord(normalizedCharacter, {
        campaignId,
        createId: () => normalizedCharacter.id,
      }));
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      createCharacterInCampaign(campaign, normalizedCharacter, { createId })
    );
  };

  const softDeleteCharacter = (campaignId, characterId) => {
    const options = { now: nowIso(), actorEmail: actor };
    const affectedMembers = Object.entries(db?.users || {})
      .filter(([, info]) =>
        info?.campaignId === campaignId &&
        [info?.assignedActorId, info?.actorId, info?.characterId].some((id) => id === characterId)
      )
      .map(([email, info]) => [normalizeEmail(email), info])
      .filter(([email]) => email);

    if (useFirestoreV2) {
      return Promise.all([
        repos.actorRepo.updateActor(firestore, campaignId, characterId, (actorDoc) => markDeleted(actorDoc, options)),
        ...affectedMembers.map(([email, info]) =>
          repos.memberRepo.assignUser(firestore, campaignId, email, {
            ...info,
            role: info?.role || "player",
            characterId: null,
            actorId: null,
            assignedActorId: null,
          })
        ),
      ]);
    }

    return updateDbLegacy((prev) => softDeleteCharacterInDb(prev, campaignId, characterId, options));
  };

  const restoreCharacter = (campaignId, characterId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.actorRepo.updateActor(firestore, campaignId, characterId, (actorDoc) => markRestored(actorDoc, options));
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      restoreCharacterInCampaign(campaign, characterId, options)
    );
  };

  const importLegacyCharacter = (campaignId, character, legacyIndex) => {
    const normalizedCharacter = createCharacterRecord(character, { createId });
    if (useFirestoreV2) {
      return repos.actorRepo.createActor(firestore, campaignId, createActorRecord(normalizedCharacter, {
        campaignId,
        createId: () => normalizedCharacter.id,
      }));
    }
    return updateDbLegacy((prev) =>
      importLegacyCharacterInDb(prev, campaignId, normalizedCharacter, legacyIndex, { createId })
    );
  };

  return {
    updateCharacter,
    createCharacter,
    softDeleteCharacter,
    restoreCharacter,
    importLegacyCharacter,
    setGold(campaignId, characterId, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterGold(character, amount));
    },
    adjustGold(campaignId, characterId, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterGold(character, amount));
    },
    setAttribute(campaignId, characterId, key, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterAttribute(character, key, value));
    },
    adjustAttribute(campaignId, characterId, key, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterAttribute(character, key, amount));
    },
    setHp(campaignId, characterId, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterHp(character, value));
    },
    adjustHp(campaignId, characterId, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterHp(character, amount));
    },
    setTempHp(campaignId, characterId, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterTempHp(character, value));
    },
    adjustTempHp(campaignId, characterId, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterTempHp(character, amount));
    },
    setMaxHp(campaignId, characterId, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterMaxHp(character, value));
    },
    adjustMaxHp(campaignId, characterId, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterMaxHp(character, amount));
    },
    setSpeed(campaignId, characterId, key, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterSpeed(character, key, value));
    },
    adjustSpeed(campaignId, characterId, key, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterSpeed(character, key, amount));
    },
    setClassDc(campaignId, characterId, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterClassDc(character, value));
    },
    adjustClassDc(campaignId, characterId, amount) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => adjustCharacterClassDc(character, amount));
    },
    setDailyCraftingMax(campaignId, characterId, value) {
      return updatePcActorAsCharacter(campaignId, characterId, (character) => setCharacterDailyCraftingMax(character, value));
    },
  };
}
