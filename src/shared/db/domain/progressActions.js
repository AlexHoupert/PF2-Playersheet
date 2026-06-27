import {
  restoreProgressEntryInCampaign,
  softDeleteProgressEntryInCampaign,
  updateProgressInCampaign,
} from "./progressReducers.js";

export function createProgressActions(actionContext) {
  const { actor, firestore, nowIso, repos, stripChildCollections, updateCampaignLegacy, useFirestoreV2 } = actionContext;

  return {
    updateProgress(campaignId, patchOrUpdater) {
      if (useFirestoreV2) {
        return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
          stripChildCollections(updateProgressInCampaign({ ...campaign, id: campaign.id || campaignId }, patchOrUpdater))
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => updateProgressInCampaign(campaign, patchOrUpdater));
    },
    softDeleteEntry(campaignId, section, entryId) {
      const options = { now: nowIso(), actorEmail: actor };
      if (useFirestoreV2) {
        return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
          stripChildCollections(
            softDeleteProgressEntryInCampaign({ ...campaign, id: campaign.id || campaignId }, section, entryId, options)
          )
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        softDeleteProgressEntryInCampaign(campaign, section, entryId, options)
      );
    },
    restoreEntry(campaignId, section, entryId) {
      const options = { now: nowIso(), actorEmail: actor };
      if (useFirestoreV2) {
        return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
          stripChildCollections(
            restoreProgressEntryInCampaign({ ...campaign, id: campaign.id || campaignId }, section, entryId, options)
          )
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        restoreProgressEntryInCampaign(campaign, section, entryId, options)
      );
    },
  };
}
