import {
  buildBestiaryRevealDeliveries,
  createKnowledgeNoteId,
  createLoreArticleDraft,
  markLoreDeliveryNotified,
  markLoreDeliveryRead,
  normalizeKnowledgeNote,
  normalizeLoreArticle,
  normalizeLoreGroup,
  publishLoreArticle,
  retractLoreArticle,
} from "../../lore/loreModel.js";
import { cloneValue } from "./inventoryReducers.js";

export function createLoreActions(context) {
  const {
    actor,
    createDomainId,
    firestore,
    nowIso,
    repos,
    updateCampaignLegacy,
    useFirestoreV2,
  } = context;

  const createDraft = (campaignId, input = {}) => {
    const article = createLoreArticleDraft(input, {
      createId: () => createDomainId("lore"),
      actor,
      now: nowIso(),
    });
    if (useFirestoreV2) {
      return repos.loreRepo.createDraft(firestore, campaignId, article, { actor, now: nowIso() })
        .then(() => article.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) => upsertCampaignRecord(campaign, "loreArticles", article))
      .then(() => article.id);
  };

  const saveDraft = (campaignId, articleId, updater) => {
    if (useFirestoreV2) {
      return repos.loreRepo.saveDraft(firestore, campaignId, articleId, updater, { actor, now: nowIso() });
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const current = (campaign.loreArticles || []).find((article) => article.id === articleId);
      if (!current) throw new Error(`Lore article not found: ${articleId}`);
      const patch = typeof updater === "function" ? updater(cloneValue(current)) : updater;
      const next = normalizeLoreArticle({ ...current, ...(patch || {}), id: articleId, updatedAt: nowIso(), updatedBy: actor });
      return upsertCampaignRecord(campaign, "loreArticles", next);
    });
  };

  const cloneArticle = async (campaignId, article) => createDraft(campaignId, {
    ...normalizeLoreArticle(article),
    id: createDomainId("lore"),
    title: `${article?.title || "Untitled article"} (Copy)`,
    publication: undefined,
    publishedSnapshot: null,
    createdAt: nowIso(),
    createdBy: actor,
  });

  const publishArticle = (campaignId, articleId, options = {}) => {
    if (useFirestoreV2) {
      return repos.loreRepo.publishArticle(firestore, campaignId, articleId, { ...options, actor, now: nowIso() });
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const current = (campaign.loreArticles || []).find((article) => article.id === articleId);
      if (!current) throw new Error(`Lore article not found: ${articleId}`);
      const activePcActorIds = selectActivePcIds(campaign);
      const existing = (campaign.loreDeliveries || []).filter((delivery) => delivery.articleId === articleId);
      const result = publishLoreArticle({
        article: current,
        activePcActorIds,
        existingDeliveries: existing,
        audience: options.audience,
        notify: options.notify,
        actor,
        now: nowIso(),
      });
      let next = upsertCampaignRecord(campaign, "loreArticles", result.article);
      for (const delivery of [...result.deliveries, ...result.revokedDeliveries]) {
        next = upsertCampaignRecord(next, "loreDeliveries", delivery);
      }
      return next;
    });
  };

  const retractArticle = (campaignId, articleId) => {
    if (useFirestoreV2) return repos.loreRepo.retractArticle(firestore, campaignId, articleId, { actor, now: nowIso() });
    return updateCampaignLegacy(campaignId, (campaign) => {
      const current = (campaign.loreArticles || []).find((article) => article.id === articleId);
      if (!current) throw new Error(`Lore article not found: ${articleId}`);
      const result = retractLoreArticle({
        article: current,
        existingDeliveries: (campaign.loreDeliveries || []).filter((delivery) => delivery.articleId === articleId),
        actor,
        now: nowIso(),
      });
      let next = upsertCampaignRecord(campaign, "loreArticles", result.article);
      result.deliveries.forEach((delivery) => { next = upsertCampaignRecord(next, "loreDeliveries", delivery); });
      return next;
    });
  };

  const archiveArticle = (campaignId, articleId) => {
    if (useFirestoreV2) return repos.loreRepo.archiveArticle(firestore, campaignId, articleId, { actor, now: nowIso() });
    return retractArticle(campaignId, articleId).then(() => saveDraft(campaignId, articleId, (article) => ({
      ...article,
      deletedAt: nowIso(),
      deletedBy: actor,
    })));
  };

  const restoreArticle = (campaignId, articleId) => {
    if (useFirestoreV2) return repos.loreRepo.restoreArticle(firestore, campaignId, articleId, { actor, now: nowIso() });
    return saveDraft(campaignId, articleId, (article) => {
      const next = { ...article, restoredAt: nowIso(), restoredBy: actor };
      delete next.deletedAt;
      delete next.deletedBy;
      return next;
    });
  };

  const saveGroup = (campaignId, group) => {
    const normalized = normalizeLoreGroup(group, { createId: () => createDomainId("lore-group") });
    if (useFirestoreV2) {
      return repos.loreRepo.saveGroup(firestore, campaignId, normalized, { actor, now: nowIso() });
    }
    return updateCampaignLegacy(campaignId, (campaign) => upsertCampaignRecord(campaign, "loreGroups", normalized))
      .then(() => normalized.id);
  };

  const archiveGroup = (campaignId, groupId) => {
    if (useFirestoreV2) return repos.loreRepo.archiveGroup(firestore, campaignId, groupId, { actor, now: nowIso() });
    return updateCampaignLegacy(campaignId, (campaign) => {
      const group = (campaign.loreGroups || []).find((entry) => entry.id === groupId);
      if (!group) return campaign;
      return upsertCampaignRecord(campaign, "loreGroups", { ...group, archivedAt: nowIso(), archivedBy: actor });
    });
  };

  const mergeGroup = (campaignId, sourceGroupId, targetGroupId) => {
    if (useFirestoreV2) return repos.loreRepo.mergeGroup(firestore, campaignId, sourceGroupId, targetGroupId, { actor, now: nowIso() });
    return updateCampaignLegacy(campaignId, (campaign) => ({
      ...campaign,
      loreArticles: (campaign.loreArticles || []).map((article) => article.groupId === sourceGroupId ? { ...article, groupId: targetGroupId } : article),
      loreGroups: (campaign.loreGroups || []).map((group) => group.id === sourceGroupId
        ? { ...group, archivedAt: nowIso(), archivedBy: actor, mergedInto: targetGroupId }
        : group.parentId === sourceGroupId ? { ...group, parentId: targetGroupId } : group),
    }));
  };

  const markDeliveryRead = (campaignId, deliveryId) => {
    if (useFirestoreV2) return repos.loreRepo.markDeliveryRead(firestore, campaignId, deliveryId, { now: nowIso() });
    return updateCampaignRecord(campaignId, "loreDeliveries", deliveryId, markLoreDeliveryRead, updateCampaignLegacy, nowIso());
  };

  const markDeliveryNotified = (campaignId, deliveryId) => {
    if (useFirestoreV2) return repos.loreRepo.markDeliveryNotified(firestore, campaignId, deliveryId, { now: nowIso() });
    return updateCampaignRecord(campaignId, "loreDeliveries", deliveryId, markLoreDeliveryNotified, updateCampaignLegacy, nowIso());
  };

  const saveNote = (campaignId, note) => {
    const normalized = normalizeKnowledgeNote(note, { now: nowIso() });
    if (useFirestoreV2) return repos.loreRepo.saveNote(firestore, campaignId, normalized, { now: nowIso() });
    return updateCampaignLegacy(campaignId, (campaign) => upsertCampaignRecord(campaign, "knowledgeNotes", normalized))
      .then(() => normalized.id);
  };

  const deleteNote = (campaignId, noteOrTarget, actorId = null) => {
    if (useFirestoreV2) return repos.loreRepo.deleteNote(firestore, campaignId, noteOrTarget, actorId);
    const id = typeof noteOrTarget === "string" && !actorId
      ? noteOrTarget
      : noteOrTarget?.id || createKnowledgeNoteId(actorId, noteOrTarget?.targetType, noteOrTarget?.targetId);
    return updateCampaignLegacy(campaignId, (campaign) => ({
      ...campaign,
      knowledgeNotes: (campaign.knowledgeNotes || []).filter((note) => note.id !== id),
    }));
  };

  const notifyBestiaryReveal = (campaignId, creature) => {
    if (useFirestoreV2) return repos.loreRepo.notifyBestiaryReveal(firestore, campaignId, creature, { actor, now: nowIso() });
    return updateCampaignLegacy(campaignId, (campaign) => {
      const activePcActorIds = selectActivePcIds(campaign);
      const existing = (campaign.loreDeliveries || []).filter((delivery) => delivery.deliveryKind === "bestiaryReveal" && delivery.referenceId === creature.id);
      const deliveries = buildBestiaryRevealDeliveries({
        creatureId: creature.id,
        creatureName: creature.name,
        activePcActorIds,
        existingDeliveries: existing,
        actor,
        now: nowIso(),
      });
      return deliveries.reduce((next, delivery) => upsertCampaignRecord(next, "loreDeliveries", delivery), campaign);
    });
  };

  return {
    archiveArticle,
    archiveGroup,
    cloneArticle,
    createDraft,
    deleteNote,
    markDeliveryNotified,
    markDeliveryRead,
    mergeGroup,
    notifyBestiaryReveal,
    publishArticle,
    restoreArticle,
    retractArticle,
    saveDraft,
    saveGroup,
    saveNote,
  };
}

function upsertCampaignRecord(campaign, field, record) {
  const next = cloneValue(campaign || {});
  const records = Array.isArray(next[field]) ? next[field] : [];
  const index = records.findIndex((entry) => entry.id === record.id);
  next[field] = index >= 0
    ? records.map((entry, recordIndex) => recordIndex === index ? cloneValue(record) : entry)
    : [...records, cloneValue(record)];
  return next;
}

function updateCampaignRecord(campaignId, field, id, reducer, updateCampaignLegacy, now) {
  return updateCampaignLegacy(campaignId, (campaign) => {
    const current = (campaign[field] || []).find((entry) => entry.id === id);
    if (!current) throw new Error(`Record not found: ${id}`);
    return upsertCampaignRecord(campaign, field, reducer(current, now));
  });
}

function selectActivePcIds(campaign) {
  const actors = Array.isArray(campaign?.actors) ? campaign.actors : [];
  return actors.filter((entry) => entry.kind === "pc" && !entry.deletedAt).map((entry) => entry.id);
}
