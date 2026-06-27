import {
  assignCampingActivityInCampaign,
  recordCampingActivityRollInCampaign,
  resetDefaultCampingActivityInCampaign,
  restoreCampingActivityInCampaign,
  softDeleteCampingActivityInCampaign,
  updateCampingInCampaign,
  unassignCampingActivityInCampaign,
  upsertCampingActivityInCampaign,
} from "./campingReducers.js";

export function createCampingActions(actionContext) {
  const {
    actor,
    createDomainId,
    firestore,
    nowIso,
    repos,
    stripChildCollections,
    updateCampaignLegacy,
    useFirestoreV2,
  } = actionContext;

  const updateCampaignScoped = (campaignId, reducer) => {
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(reducer({ ...campaign, id: campaign.id || campaignId }))
      );
    }
    return updateCampaignLegacy(campaignId, reducer);
  };

  return {
    updateSettings(campaignId, patchOrUpdater) {
      return updateCampaignScoped(campaignId, (campaign) => updateCampingInCampaign(campaign, patchOrUpdater));
    },
    upsertActivity(campaignId, activity) {
      const options = { createId: () => createDomainId("camping_activity") };
      return updateCampaignScoped(campaignId, (campaign) => upsertCampingActivityInCampaign(campaign, activity, options));
    },
    deleteActivity(campaignId, activityId) {
      const options = { now: nowIso(), actorEmail: actor };
      return updateCampaignScoped(campaignId, (campaign) =>
        softDeleteCampingActivityInCampaign(campaign, activityId, options)
      );
    },
    restoreActivity(campaignId, activityId) {
      const options = { now: nowIso(), actorEmail: actor };
      return updateCampaignScoped(campaignId, (campaign) =>
        restoreCampingActivityInCampaign(campaign, activityId, options)
      );
    },
    resetDefaultActivity(campaignId, activityId) {
      return updateCampaignScoped(campaignId, (campaign) => resetDefaultCampingActivityInCampaign(campaign, activityId));
    },
    assignActivity(campaignId, activityId, character) {
      const options = { now: nowIso(), actorEmail: actor };
      return updateCampaignScoped(campaignId, (campaign) =>
        assignCampingActivityInCampaign(campaign, activityId, character, options)
      );
    },
    recordActivityRoll(campaignId, activityId, character, rollResult) {
      const options = { now: nowIso(), actorEmail: actor };
      return updateCampaignScoped(campaignId, (campaign) =>
        recordCampingActivityRollInCampaign(campaign, activityId, character, rollResult, options)
      );
    },
    unassignActivity(campaignId, activityId, character) {
      return updateCampaignScoped(campaignId, (campaign) =>
        unassignCampingActivityInCampaign(campaign, activityId, character)
      );
    },
  };
}
