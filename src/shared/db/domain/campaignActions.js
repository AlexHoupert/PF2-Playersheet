import {
  addPartyXpInCampaign,
  applyCampaignUpdate,
  assignUserInDb,
  createCampaignInDb,
  createCampaignRecord,
  markDeleted,
  markRestored,
  restoreCampaignInDb,
  setCampaignXpThresholdInCampaign,
  setPartyXpInCampaign,
  softDeleteCampaignInDb,
} from "./campaignReducers.js";
import { clearCampaignNotificationInCampaign } from "./questReducers.js";
import { cloneValue } from "./inventoryReducers.js";

export function createCampaignActions(context) {
  const {
    actor,
    actorDocToCharacter,
    characterToPcActorDoc,
    db,
    firestore,
    getActivePcActorIds,
    repos,
    nowIso,
    stripChildCollections,
    updateCampaignLegacy,
    updateDbLegacy,
    useFirestoreV2,
  } = context;

  const createCampaign = (name) => {
    const campaignId = `campaign_${Date.now()}`;
    const campaign = createCampaignRecord(name, { id: campaignId, now: Date.now() });

    if (useFirestoreV2) {
      const writes = [repos.campaignRepo.createCampaign(firestore, campaign)];
      if (actor) {
        writes.push(repos.memberRepo.assignUser(firestore, campaignId, actor, {
          role: "gm",
          characterId: null,
        }));
      }
      return Promise.all(writes).then(() => campaignId);
    }

    return updateDbLegacy((prev) => {
      let next = createCampaignInDb(prev, campaign, { campaignId });
      if (actor) next = assignUserInDb(next, actor, campaignId, null, "gm");
      return next;
    }).then(() => campaignId);
  };

  const updateCampaign = (campaignId, updater) => {
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        applyCampaignUpdate({ ...campaign, id: campaign.id || campaignId }, updater)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => applyCampaignUpdate(campaign, updater));
  };

  const softDeleteCampaign = (campaignId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) => markDeleted(campaign, options));
    }
    return updateDbLegacy((prev) => softDeleteCampaignInDb(prev, campaignId, options));
  };

  const restoreCampaign = (campaignId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) => markRestored(campaign, options));
    }
    return updateDbLegacy((prev) => restoreCampaignInDb(prev, campaignId, options));
  };

  const setPartyXp = (campaignId, xp) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeActorIds = getActivePcActorIds(campaign);

    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaignAndActors(
        firestore,
        campaignId,
        activeActorIds,
        (campaignDoc, actorsById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            characters: activeActorIds.map((actorId) => actorDocToCharacter(actorsById[actorId], actorId)),
          };
          const nextCampaign = setPartyXpInCampaign(current, xp);
          return {
            campaign: stripChildCollections(nextCampaign),
            actorsById: Object.fromEntries(
              nextCampaign.characters.map((character) => [
                character.id,
                characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
              ])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) => setPartyXpInCampaign(campaignState, xp));
  };

  const setXpThreshold = (campaignId, threshold) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeActorIds = getActivePcActorIds(campaign);

    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaignAndActors(
        firestore,
        campaignId,
        activeActorIds,
        (campaignDoc, actorsById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            characters: activeActorIds.map((actorId) => actorDocToCharacter(actorsById[actorId], actorId)),
          };
          const nextCampaign = setCampaignXpThresholdInCampaign(current, threshold);
          return {
            campaign: stripChildCollections(nextCampaign),
            actorsById: Object.fromEntries(
              nextCampaign.characters.map((character) => [
                character.id,
                characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
              ])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) =>
      setCampaignXpThresholdInCampaign(campaignState, threshold)
    );
  };

  const addPartyXp = (campaignId, amount) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeActorIds = getActivePcActorIds(campaign);
    const notificationId = Date.now();

    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaignAndActors(
        firestore,
        campaignId,
        activeActorIds,
        (campaignDoc, actorsById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            characters: activeActorIds.map((actorId) => actorDocToCharacter(actorsById[actorId], actorId)),
          };
          const nextCampaign = addPartyXpInCampaign(current, amount, { notificationId });
          return {
            campaign: stripChildCollections(nextCampaign),
            actorsById: Object.fromEntries(
              nextCampaign.characters.map((character) => [
                character.id,
                characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
              ])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) =>
      addPartyXpInCampaign(campaignState, amount, { notificationId })
    );
  };

  const clearNotification = (campaignId, notificationId) => {
    if (useFirestoreV2 && campaignId) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        clearCampaignNotificationInCampaign({ ...campaign, id: campaign.id || campaignId }, notificationId)
      );
    }
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev) || {};
      if (campaignId && next.campaigns?.[campaignId]) {
        next.campaigns[campaignId] = clearCampaignNotificationInCampaign(next.campaigns[campaignId], notificationId);
      }
      next.notificationQueue = (next.notificationQueue || []).filter((item) => item.id !== notificationId);
      return next;
    });
  };

  return {
    createCampaign,
    softDeleteCampaign,
    restoreCampaign,
    updateCampaign,
    setXpThreshold,
    setPartyXp,
    addPartyXp,
    clearNotification,
  };
}
