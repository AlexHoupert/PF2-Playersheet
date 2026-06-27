import {
  applyActorUpdate,
  createActorRecord,
} from "./actorReducers.js";
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
import { markDeleted, markRestored } from "./campaignReducers.js";
import {
  addItemToCharacter,
  cloneValue,
  findInventoryItemIndex,
  normalizeCharacterInventory,
  removeInventoryItem,
  transferInventoryItem,
} from "./inventoryReducers.js";

export function createActorActions(context) {
  const {
    actor,
    actorDocToCharacter,
    characterToPcActorDoc,
    createDomainId,
    createId,
    firestore,
    nowIso,
    repos,
    updateActorLegacy,
    updateCampaignLegacy,
    updatePcActorAsCharacter,
    useFirestoreV2,
  } = context;

  const createActor = (campaignId, actorInput) => {
    const actorRecord = createActorRecord(actorInput, {
      createId: () => createDomainId("actor"),
      campaignId,
    });
    if (useFirestoreV2) {
      return repos.actorRepo.createActor(firestore, campaignId, actorRecord).then(() => actorRecord.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.actors = Array.isArray(next.actors) ? [...next.actors, actorRecord] : [actorRecord];
      return next;
    }).then(() => actorRecord.id);
  };

  const updateActor = (campaignId, actorId, updater) => {
    if (useFirestoreV2) {
      return repos.actorRepo.updateActor(firestore, campaignId, actorId, (actorDoc) =>
        applyActorUpdate({ ...actorDoc, id: actorDoc.id || actorId, campaignId }, updater, {
          createId: () => createDomainId("actor"),
          campaignId,
        })
      );
    }
    return updateActorLegacy(campaignId, actorId, updater);
  };

  const softDeleteActor = (campaignId, actorId) => {
    const options = { now: nowIso(), actorEmail: actor };
    return updateActor(campaignId, actorId, (actorDoc) => markDeleted(actorDoc, options));
  };

  const restoreActor = (campaignId, actorId) => {
    const options = { now: nowIso(), actorEmail: actor };
    return updateActor(campaignId, actorId, (actorDoc) => markRestored(actorDoc, options));
  };

  return {
    createActor,
    updateActor,
    softDeleteActor,
    archiveActor: softDeleteActor,
    restoreActor,
    setGold(campaignId, actorId, amount) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => setCharacterGold(character, amount));
    },
    adjustGold(campaignId, actorId, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => adjustCharacterGold(character, delta));
    },
    setAttribute(campaignId, actorId, attributeKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) =>
        setCharacterAttribute(character, attributeKey, value)
      );
    },
    setStat(campaignId, actorId, attributeKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) =>
        setCharacterAttribute(character, attributeKey, value)
      );
    },
    adjustAttribute(campaignId, actorId, attributeKey, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) =>
        adjustCharacterAttribute(character, attributeKey, delta)
      );
    },
    setHp(campaignId, actorId, hp) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => setCharacterHp(character, hp));
    },
    adjustHp(campaignId, actorId, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => adjustCharacterHp(character, delta));
    },
    setTempHp(campaignId, actorId, hp) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => setCharacterTempHp(character, hp));
    },
    adjustTempHp(campaignId, actorId, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => adjustCharacterTempHp(character, delta));
    },
    setMaxHp(campaignId, actorId, hp) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => setCharacterMaxHp(character, hp));
    },
    adjustMaxHp(campaignId, actorId, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => adjustCharacterMaxHp(character, delta));
    },
    setSpeed(campaignId, actorId, speed) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => setCharacterSpeed(character, speed));
    },
    adjustSpeed(campaignId, actorId, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => adjustCharacterSpeed(character, delta));
    },
    setClassDc(campaignId, actorId, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => setCharacterClassDc(character, value));
    },
    adjustClassDc(campaignId, actorId, delta) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => adjustCharacterClassDc(character, delta));
    },
    setDailyCraftingMax(campaignId, actorId, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) =>
        setCharacterDailyCraftingMax(character, value)
      );
    },
    setSkill(campaignId, actorId, skillKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.skills = next.stats.skills && typeof next.stats.skills === "object" ? cloneValue(next.stats.skills) : {};
        next.skills = next.skills && typeof next.skills === "object" ? cloneValue(next.skills) : {};
        if (value === null || value === undefined) {
          delete next.stats.skills[skillKey];
          delete next.skills[skillKey];
        } else {
          next.stats.skills[skillKey] = value;
          next.skills[skillKey] = value;
        }
        return next;
      });
    },
    setSave(campaignId, actorId, saveKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.saves = next.stats.saves && typeof next.stats.saves === "object" ? cloneValue(next.stats.saves) : {};
        if (value === null || value === undefined) delete next.stats.saves[saveKey];
        else next.stats.saves[saveKey] = value;
        return next;
      });
    },
    setArmorProficiency(campaignId, actorId, armorKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.proficiencies = next.stats.proficiencies && typeof next.stats.proficiencies === "object"
          ? cloneValue(next.stats.proficiencies)
          : {};
        next.stats.proficiencies[String(armorKey || "").toLowerCase()] = value;
        return next;
      });
    },
    setProficiency(campaignId, actorId, proficiencyKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.proficiencies = next.proficiencies && typeof next.proficiencies === "object"
          ? cloneValue(next.proficiencies)
          : {};
        next.proficiencies[proficiencyKey] = value;
        return next;
      });
    },
    setSpellProficiency(campaignId, actorId, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.spell_proficiency = Number(value) || 0;
        return next;
      });
    },
    setImpulseProficiency(campaignId, actorId, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.impulse_proficiency = Number(value) || 0;
        return next;
      });
    },
    setPerception(campaignId, actorId, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.perception = Number(value) || 0;
        return next;
      });
    },
    setMagicAttribute(campaignId, actorId, attribute) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.magic = next.magic && typeof next.magic === "object" ? cloneValue(next.magic) : { slots: {}, list: [] };
        next.magic.attribute = attribute;
        return next;
      });
    },
    setMagicProficiency(campaignId, actorId, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.magic = next.magic && typeof next.magic === "object" ? cloneValue(next.magic) : { slots: {}, list: [] };
        next.magic.proficiency = Number(value) || 0;
        return next;
      });
    },
    setMagicSlot(campaignId, actorId, slotKey, value) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = cloneValue(character);
        next.magic = next.magic && typeof next.magic === "object" ? cloneValue(next.magic) : { slots: {}, list: [] };
        next.magic.slots = next.magic.slots && typeof next.magic.slots === "object" ? cloneValue(next.magic.slots) : {};
        next.magic.slots[slotKey] = Number(value) || 0;
        return next;
      });
    },
    setEquipmentState(campaignId, actorId, patch) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        if (typeof patch === "function") return patch(character);
        const next = cloneValue(character);
        next.stats = next.stats && typeof next.stats === "object" ? cloneValue(next.stats) : {};
        next.stats.ac = next.stats.ac && typeof next.stats.ac === "object" ? cloneValue(next.stats.ac) : {};
        Object.assign(next.stats.ac, patch || {});
        return next;
      });
    },
    addItem(campaignId, actorId, item, options = {}) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) =>
        addItemToCharacter(character, item, { ...options, createId })
      );
    },
    updateItem(campaignId, actorId, item, updater) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) => {
        const next = normalizeCharacterInventory(character, { createId });
        const index = findInventoryItemIndex(next.inventory, item);
        if (index < 0) return next;
        next.inventory[index] =
          typeof updater === "function"
            ? updater(next.inventory[index])
            : { ...next.inventory[index], ...updater };
        return normalizeCharacterInventory(next, { createId });
      });
    },
    removeItem(campaignId, actorId, item) {
      return updatePcActorAsCharacter(campaignId, actorId, (character) =>
        removeInventoryItem(character, item, { createId })
      );
    },
    transferItem(campaignId, fromActorId, toActorId, item, qty) {
      if (useFirestoreV2) {
        return repos.actorRepo.updateActors(
          firestore,
          campaignId,
          [fromActorId, toActorId],
          (actorsById) => {
            const nextCampaign = transferInventoryItem(
              {
                id: campaignId,
                characters: [
                  actorDocToCharacter(actorsById[fromActorId], fromActorId),
                  actorDocToCharacter(actorsById[toActorId], toActorId),
                ],
              },
              fromActorId,
              toActorId,
              item,
              qty,
              { createId }
            );
            return Object.fromEntries(
              nextCampaign.characters.map((character) => [
                character.id,
                characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
              ])
            );
          }
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        transferInventoryItem(campaign, fromActorId, toActorId, item, qty, { createId })
      );
    },
  };
}
