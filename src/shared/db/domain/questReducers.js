import { isSoftDeleted, markDeleted, markRestored } from "./campaignReducers.js";
import { applyCharacterUpdate, cloneValue, createInstanceId } from "./inventoryReducers.js";

export function createQuestRecord(quest = {}, options = {}) {
  const { createId = () => createInstanceId("quest") } = options;
  const next = normalizeQuest({
    id: quest.id || createId(quest),
    title: quest.title || "New Quest",
    type: quest.type || "Side",
    status: quest.status || "Active",
    descriptionPublic: quest.descriptionPublic || "",
    descriptionGM: quest.descriptionGM || "",
    objectives: quest.objectives || [],
    rewards: quest.rewards || { xp: 0, gold: 0, items: "", reputation: [] },
    subquests: quest.subquests || [],
    parentId: quest.parentId || null,
    ...cloneValue(quest),
  });
  delete next.deletedAt;
  delete next.deletedBy;
  return next;
}

export function applyQuestUpdate(quest, updater, options = {}) {
  const current = normalizeQuest(quest);
  const result = typeof updater === "function" ? updater(cloneValue(current)) : { ...current, ...updater };
  return normalizeQuest(result || current, options);
}

export function upsertQuestInCampaign(campaign, quest, options = {}) {
  const next = cloneValue(campaign) || {};
  next.quests = Array.isArray(next.quests) ? next.quests.map((entry) => cloneValue(entry)) : [];
  const normalizedQuest = createQuestRecord(quest, options);
  const index = next.quests.findIndex((entry) => entry.id === normalizedQuest.id);
  if (index >= 0) next.quests[index] = normalizedQuest;
  else next.quests.push(normalizedQuest);
  return next;
}

export function updateQuestInCampaign(campaign, questId, updater, options = {}) {
  const next = cloneValue(campaign) || {};
  next.quests = Array.isArray(next.quests) ? next.quests.map((entry) => cloneValue(entry)) : [];
  const index = next.quests.findIndex((quest) => quest.id === questId);
  if (index < 0) return next;
  next.quests[index] = applyQuestUpdate(next.quests[index], updater, options);
  return next;
}

export function softDeleteQuestTreeInCampaign(campaign, questId, options = {}) {
  return markQuestTree(campaign, questId, (quest) => markDeleted(quest, options));
}

export function restoreQuestTreeInCampaign(campaign, questId, options = {}) {
  return markQuestTree(campaign, questId, (quest) => markRestored(quest, options));
}

export function collectQuestTreeIds(quests = [], questId) {
  const ids = new Set([questId]);
  const visit = (parentId) => {
    quests
      .filter((quest) => quest.parentId === parentId)
      .forEach((quest) => {
        ids.add(quest.id);
        visit(quest.id);
      });
  };
  visit(questId);
  return [...ids].filter(Boolean);
}

export function toggleQuestObjectiveInCampaign(campaign, questId, objectiveIndex, completed, options = {}) {
  const {
    now = new Date().toISOString(),
    actorEmail = null,
    createId = () => createInstanceId("notification"),
  } = options;
  const next = cloneValue(campaign) || {};
  next.quests = Array.isArray(next.quests) ? next.quests.map((entry) => cloneValue(entry)) : [];
  next.characters = Array.isArray(next.characters) ? next.characters.map((entry) => cloneValue(entry)) : [];

  const questIndex = next.quests.findIndex((quest) => quest.id === questId);
  if (questIndex < 0) return next;

  const quest = normalizeQuest(next.quests[questIndex]);
  if (!quest.objectives[objectiveIndex]) return next;

  const objective = { ...quest.objectives[objectiveIndex] };
  const wasCompleted = Boolean(objective.completed);
  const willComplete = Boolean(completed);
  objective.completed = willComplete;

  let objectiveRewards = null;
  if (!wasCompleted && willComplete) {
    if (objective.choiceGroup) {
      quest.objectives = quest.objectives.map((entry, index) => {
        if (index !== objectiveIndex && entry.choiceGroup === objective.choiceGroup && !entry.completed) {
          return { ...entry, failed: true };
        }
        return entry;
      });
    }

    if (!objective.rewardAppliedAt && hasRewards(objective)) {
      objective.rewardAppliedAt = now;
      objective.rewardAppliedBy = actorEmail || null;
      objectiveRewards = objective;
    }
  }

  quest.objectives[objectiveIndex] = objective;

  const nonFailedObjectives = quest.objectives.filter((entry) => !entry.failed);
  const allComplete =
    nonFailedObjectives.length > 0 && nonFailedObjectives.every((entry) => Boolean(entry.completed));

  let questRewards = null;
  if (!wasCompleted && willComplete && allComplete && quest.status !== "Completed") {
    quest.status = "Completed";
    if (!quest.rewardAppliedAt) {
      quest.rewardAppliedAt = now;
      quest.rewardAppliedBy = actorEmail || null;
      questRewards = quest.rewards || {};
    }
  }

  next.quests[questIndex] = quest;

  if (objectiveRewards) {
    applyRewards(next, objectiveRewards, {
      createId,
      notificationPrefix: null,
    });
  }

  if (questRewards) {
    appendNotification(next, { id: createId({ type: "quest", questId }), type: "quest", text: quest.title });
    applyRewards(next, questRewards, {
      createId,
      notificationPrefix: null,
    });
  }

  return next;
}

export function toggleQuestObjectiveHiddenInCampaign(campaign, questId, objectiveIndex) {
  return updateQuestInCampaign(campaign, questId, (quest) => {
    const objectives = Array.isArray(quest.objectives) ? [...quest.objectives] : [];
    if (!objectives[objectiveIndex]) return quest;
    objectives[objectiveIndex] = {
      ...objectives[objectiveIndex],
      hidden: !objectives[objectiveIndex].hidden,
    };
    return { ...quest, objectives };
  });
}

export function revealQuestSecretInCampaign(campaign, questId, secretText) {
  return updateQuestInCampaign(campaign, questId, (quest) => {
    const target = `||${secretText}||`;
    if (!quest.descriptionPublic?.includes(target)) return quest;
    return {
      ...quest,
      descriptionPublic: quest.descriptionPublic.replaceAll(target, secretText),
    };
  });
}

export function clearCampaignNotificationInCampaign(campaign, notificationId) {
  const next = cloneValue(campaign) || {};
  next.notificationQueue = (next.notificationQueue || []).filter((notification) => notification.id !== notificationId);
  return next;
}

export function normalizeQuest(quest = {}) {
  const next = cloneValue(quest) || {};
  next.id = next.id || createInstanceId("quest");
  next.title = next.title || "Untitled Quest";
  next.type = next.type || "Side";
  next.status = next.status || "Active";
  next.objectives = Array.isArray(next.objectives) ? next.objectives.map(normalizeObjective) : [];
  next.rewards = normalizeRewards(next.rewards);
  next.subquests = Array.isArray(next.subquests) ? next.subquests : [];
  if (!next.parentId) next.parentId = null;
  delete next.tempObjectivesText;
  return next;
}

function markQuestTree(campaign, questId, marker) {
  const next = cloneValue(campaign) || {};
  next.quests = Array.isArray(next.quests) ? next.quests.map((entry) => cloneValue(entry)) : [];
  const ids = new Set(collectQuestTreeIds(next.quests, questId));
  next.quests = next.quests.map((quest) => (ids.has(quest.id) ? marker(quest) : quest));
  return next;
}

function normalizeObjective(objective = {}) {
  const next = cloneValue(objective) || {};
  next.text = next.text || "";
  next.completed = Boolean(next.completed);
  next.hidden = Boolean(next.hidden);
  next.failed = Boolean(next.failed);
  next.xp = numberOr(next.xp, 0);
  next.gold = numberOr(next.gold, 0);
  next.reputation = Array.isArray(next.reputation) ? next.reputation.map(normalizeReputation) : [];
  if (!next.choiceGroup) delete next.choiceGroup;
  return next;
}

function normalizeRewards(rewards = {}) {
  const next = cloneValue(rewards) || {};
  return {
    xp: numberOr(next.xp, 0),
    gold: numberOr(next.gold, 0),
    items: next.items || "",
    reputation: Array.isArray(next.reputation) ? next.reputation.map(normalizeReputation) : [],
  };
}

function normalizeReputation(reputation = {}) {
  return {
    faction: reputation.faction || "",
    value: numberOr(reputation.value, 0),
  };
}

function applyRewards(campaign, rewards, options = {}) {
  const { createId = () => createInstanceId("notification") } = options;
  const xp = numberOr(rewards.xp, 0);
  const gold = numberOr(rewards.gold, 0);
  const reputation = Array.isArray(rewards.reputation) ? rewards.reputation : [];

  const activeCharacters = campaign.characters.filter((character) => !isSoftDeleted(character));
  campaign.characters = campaign.characters.map((character) => {
    if (isSoftDeleted(character)) return character;
    return applyCharacterUpdate(character, (nextCharacter) => {
      if (xp > 0) {
        nextCharacter.xp = {
          ...(nextCharacter.xp || { current: 0, max: 1000 }),
          current: (Number(nextCharacter.xp?.current) || 0) + xp,
        };
        if (!nextCharacter.xp.max) nextCharacter.xp.max = 1000;
      }
      if (gold > 0) {
        const currentGold = Number.parseFloat(nextCharacter.gold || 0) || 0;
        nextCharacter.gold = (currentGold + gold).toFixed(2);
      }
      return nextCharacter;
    });
  });

  if (xp > 0) {
    campaign.xp = (Number(campaign.xp) || 0) + xp;
    appendNotification(campaign, { id: createId({ type: "xp" }), type: "xp", amount: xp });
  }

  if (gold > 0 && activeCharacters.length > 0) {
    appendNotification(campaign, { id: createId({ type: "gold" }), type: "gold", amount: gold });
  }

  reputation.forEach((entry) => {
    appendNotification(campaign, {
      id: createId({ type: "reputation", faction: entry.faction }),
      type: "reputation",
      faction: entry.faction,
      amount: entry.value,
    });
  });
}

function appendNotification(campaign, notification) {
  campaign.notificationQueue = [...(campaign.notificationQueue || []), notification];
}

function hasRewards(rewards = {}) {
  return (
    numberOr(rewards.xp, 0) > 0 ||
    numberOr(rewards.gold, 0) > 0 ||
    (Array.isArray(rewards.reputation) && rewards.reputation.length > 0)
  );
}

function numberOr(value, fallback) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}
