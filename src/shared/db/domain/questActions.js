import { markDeleted, markRestored } from "./campaignReducers.js";
import {
  applyQuestUpdate,
  collectQuestTreeIds,
  createQuestRecord,
  restoreQuestTreeInCampaign,
  revealQuestSecretInCampaign,
  softDeleteQuestTreeInCampaign,
  toggleQuestObjectiveHiddenInCampaign,
  toggleQuestObjectiveInCampaign,
  updateQuestInCampaign,
  upsertQuestInCampaign,
} from "./questReducers.js";

export function createQuestActions(actionContext) {
  const {
    actor,
    actorDocToCharacter,
    characterToPcActorDoc,
    createDomainId,
    db,
    firestore,
    getActivePcActorIds,
    nowIso,
    repos,
    stripChildCollections,
    updateCampaignLegacy,
    useFirestoreV2,
  } = actionContext;

  return {
    createQuest(campaignId, quest) {
      const normalizedQuest = createQuestRecord(quest, { createId: () => createDomainId("quest") });
      if (useFirestoreV2) {
        return repos.questRepo.createQuest(firestore, campaignId, normalizedQuest).then(() => normalizedQuest.id);
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        upsertQuestInCampaign(campaign, normalizedQuest, { createId: () => createDomainId("quest") })
      ).then(() => normalizedQuest.id);
    },
    updateQuest(campaignId, questId, updater) {
      if (useFirestoreV2) {
        return repos.questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
          applyQuestUpdate({ ...quest, id: quest.id || questId }, updater)
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => updateQuestInCampaign(campaign, questId, updater));
    },
    softDeleteQuest(campaignId, questId) {
      const options = { now: nowIso(), actorEmail: actor };
      const questIds = collectQuestTreeIds(db?.campaigns?.[campaignId]?.quests || [], questId);
      if (useFirestoreV2) {
        return repos.questRepo.updateQuests(firestore, campaignId, questIds, (questsById) =>
          Object.fromEntries(Object.entries(questsById).map(([id, quest]) => [id, markDeleted(quest, options)]))
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => softDeleteQuestTreeInCampaign(campaign, questId, options));
    },
    restoreQuest(campaignId, questId) {
      const options = { now: nowIso(), actorEmail: actor };
      const questIds = collectQuestTreeIds(db?.campaigns?.[campaignId]?.quests || [], questId);
      if (useFirestoreV2) {
        return repos.questRepo.updateQuests(firestore, campaignId, questIds, (questsById) =>
          Object.fromEntries(Object.entries(questsById).map(([id, quest]) => [id, markRestored(quest, options)]))
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => restoreQuestTreeInCampaign(campaign, questId, options));
    },
    toggleObjective(campaignId, questId, objectiveIndex, completed) {
      const campaign = db?.campaigns?.[campaignId];
      const activeActorIds = getActivePcActorIds(campaign);
      const options = {
        now: nowIso(),
        actorEmail: actor,
        createId: () => createDomainId("notification"),
      };

      if (useFirestoreV2) {
        return repos.questRepo.updateQuestAndCampaignAndActors(
          firestore,
          campaignId,
          questId,
          activeActorIds,
          (questDoc, campaignDoc, actorsById) => {
            const current = {
              ...campaignDoc,
              id: campaignDoc.id || campaignId,
              quests: [{ ...questDoc, id: questDoc.id || questId }],
              characters: activeActorIds.map((actorId) => actorDocToCharacter(actorsById[actorId], actorId)),
            };
            const nextCampaign = toggleQuestObjectiveInCampaign(current, questId, objectiveIndex, completed, options);
            const nextQuest = nextCampaign.quests.find((quest) => quest.id === questId);
            return {
              quest: nextQuest || questDoc,
              campaign: stripChildCollections(nextCampaign),
              actorsById: Object.fromEntries(
                (nextCampaign.characters || []).map((character) => [
                  character.id,
                  characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
                ])
              ),
            };
          }
        );
      }

      return updateCampaignLegacy(campaignId, (campaignState) =>
        toggleQuestObjectiveInCampaign(campaignState, questId, objectiveIndex, completed, options)
      );
    },
    toggleObjectiveHidden(campaignId, questId, objectiveIndex) {
      if (useFirestoreV2) {
        return repos.questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
          toggleQuestObjectiveHiddenInCampaign(
            { quests: [{ ...quest, id: quest.id || questId }] },
            questId,
            objectiveIndex
          ).quests[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        toggleQuestObjectiveHiddenInCampaign(campaign, questId, objectiveIndex)
      );
    },
    revealSecret(campaignId, questId, secretText) {
      if (useFirestoreV2) {
        return repos.questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
          revealQuestSecretInCampaign({ quests: [{ ...quest, id: quest.id || questId }] }, questId, secretText).quests[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => revealQuestSecretInCampaign(campaign, questId, secretText));
    },
  };
}
