import {
  collection,
  deleteDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  buildBestiaryRevealDeliveries,
  createBestiaryRevealDeliveryId,
  createLoreArticleDraft,
  createKnowledgeNoteId,
  markLoreDeliveryNotified,
  markLoreDeliveryRead,
  normalizeKnowledgeNote,
  normalizeLoreArticle,
  normalizeLoreGroup,
  publishLoreArticle,
  retractLoreArticle,
} from "../../lore/loreModel.js";
import { cleanForFirestore } from "./normalizers.js";
import { campaignChildDocRef } from "./repositories.js";
import { V2_COLLECTIONS, V2_SCHEMA_VERSION } from "./schema.js";

export const loreRepo = {
  async createDraft(firestore, campaignId, article, options = {}) {
    const normalized = createLoreArticleDraft(article, options);
    await setDoc(
      loreDoc(firestore, campaignId, V2_COLLECTIONS.loreArticles, normalized.id),
      prepareDocument({ ...normalized, campaignId })
    );
    return normalized.id;
  },

  async saveDraft(firestore, campaignId, articleId, updater, options = {}) {
    const ref = loreDoc(firestore, campaignId, V2_COLLECTIONS.loreArticles, articleId);
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error(`Lore article not found: ${articleId}`);
      const current = normalizeLoreArticle(snapshot.data());
      const patch = typeof updater === "function" ? updater(current) : updater;
      const next = normalizeLoreArticle({
        ...current,
        ...(patch || {}),
        id: articleId,
        campaignId,
        updatedAt: options.now || new Date().toISOString(),
        updatedBy: options.actor || current.updatedBy || null,
      });
      transaction.set(ref, prepareDocument(next));
    });
  },

  async publishArticle(firestore, campaignId, articleId, options = {}) {
    const articleRef = loreDoc(firestore, campaignId, V2_COLLECTIONS.loreArticles, articleId);
    const actorSnapshot = await getDocs(collection(
      firestore,
      V2_COLLECTIONS.campaigns,
      campaignId,
      V2_COLLECTIONS.actors
    ));
    const activePcActorIds = actorSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .filter((actor) => actor.kind === "pc" && !actor.deletedAt)
      .map((actor) => actor.id);
    const deliverySnapshot = await getDocs(query(
      collection(firestore, V2_COLLECTIONS.campaigns, campaignId, V2_COLLECTIONS.loreDeliveries),
      where("articleId", "==", articleId)
    ));
    const deliveryRefs = deliverySnapshot.docs.map((snapshot) => snapshot.ref);

    await runTransaction(firestore, async (transaction) => {
      const articleSnapshot = await transaction.get(articleRef);
      if (!articleSnapshot.exists()) throw new Error(`Lore article not found: ${articleId}`);
      const deliveryDocs = await Promise.all(deliveryRefs.map((ref) => transaction.get(ref)));
      const existingDeliveries = deliveryDocs.filter((entry) => entry.exists()).map((entry) => entry.data());
      const result = publishLoreArticle({
        article: articleSnapshot.data(),
        activePcActorIds,
        existingDeliveries,
        audience: options.audience,
        notify: options.notify,
        actor: options.actor || null,
        now: options.now || new Date().toISOString(),
      });
      transaction.set(articleRef, prepareDocument({ ...result.article, campaignId }));
      [...result.deliveries, ...result.revokedDeliveries].forEach((delivery) => {
        transaction.set(
          loreDoc(firestore, campaignId, V2_COLLECTIONS.loreDeliveries, delivery.id),
          prepareDocument({ ...delivery, campaignId })
        );
      });
    });
  },

  async retractArticle(firestore, campaignId, articleId, options = {}) {
    const articleRef = loreDoc(firestore, campaignId, V2_COLLECTIONS.loreArticles, articleId);
    const deliverySnapshot = await getDocs(query(
      collection(firestore, V2_COLLECTIONS.campaigns, campaignId, V2_COLLECTIONS.loreDeliveries),
      where("articleId", "==", articleId)
    ));
    await runTransaction(firestore, async (transaction) => {
      const articleSnapshot = await transaction.get(articleRef);
      if (!articleSnapshot.exists()) throw new Error(`Lore article not found: ${articleId}`);
      const deliveries = await Promise.all(deliverySnapshot.docs.map((entry) => transaction.get(entry.ref)));
      const result = retractLoreArticle({
        article: articleSnapshot.data(),
        existingDeliveries: deliveries.filter((entry) => entry.exists()).map((entry) => entry.data()),
        actor: options.actor || null,
        now: options.now || new Date().toISOString(),
      });
      transaction.set(articleRef, prepareDocument({ ...result.article, campaignId }));
      result.deliveries.forEach((delivery) => transaction.set(
        loreDoc(firestore, campaignId, V2_COLLECTIONS.loreDeliveries, delivery.id),
        prepareDocument({ ...delivery, campaignId })
      ));
    });
  },

  async archiveArticle(firestore, campaignId, articleId, options = {}) {
    await loreRepo.retractArticle(firestore, campaignId, articleId, options);
    await loreRepo.saveDraft(firestore, campaignId, articleId, (article) => ({
      ...article,
      deletedAt: options.now || new Date().toISOString(),
      deletedBy: options.actor || null,
    }), options);
  },

  async restoreArticle(firestore, campaignId, articleId, options = {}) {
    await loreRepo.saveDraft(firestore, campaignId, articleId, (article) => {
      const next = { ...article, restoredAt: options.now || new Date().toISOString(), restoredBy: options.actor || null };
      delete next.deletedAt;
      delete next.deletedBy;
      return next;
    }, options);
  },

  async saveGroup(firestore, campaignId, group, options = {}) {
    const normalized = normalizeLoreGroup({
      ...group,
      campaignId,
      updatedAt: options.now || new Date().toISOString(),
      updatedBy: options.actor || null,
    }, options);
    await setDoc(
      loreDoc(firestore, campaignId, V2_COLLECTIONS.loreGroups, normalized.id),
      prepareDocument(normalized)
    );
    return normalized.id;
  },

  async archiveGroup(firestore, campaignId, groupId, options = {}) {
    const ref = loreDoc(firestore, campaignId, V2_COLLECTIONS.loreGroups, groupId);
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error(`Lore group not found: ${groupId}`);
      transaction.set(ref, prepareDocument({
        ...snapshot.data(),
        archivedAt: options.now || new Date().toISOString(),
        archivedBy: options.actor || null,
      }));
    });
  },

  async mergeGroup(firestore, campaignId, sourceGroupId, targetGroupId, options = {}) {
    if (!sourceGroupId || !targetGroupId || sourceGroupId === targetGroupId) return;
    const [articlesSnapshot, groupsSnapshot] = await Promise.all([
      getDocs(query(
        collection(firestore, V2_COLLECTIONS.campaigns, campaignId, V2_COLLECTIONS.loreArticles),
        where("groupId", "==", sourceGroupId)
      )),
      getDocs(query(
        collection(firestore, V2_COLLECTIONS.campaigns, campaignId, V2_COLLECTIONS.loreGroups),
        where("parentId", "==", sourceGroupId)
      )),
    ]);
    const batch = writeBatch(firestore);
    const now = options.now || new Date().toISOString();
    articlesSnapshot.docs.forEach((snapshot) => batch.set(snapshot.ref, prepareDocument({
      ...snapshot.data(), groupId: targetGroupId, updatedAt: now, updatedBy: options.actor || null,
    })));
    groupsSnapshot.docs.forEach((snapshot) => batch.set(snapshot.ref, prepareDocument({
      ...snapshot.data(), parentId: targetGroupId, updatedAt: now, updatedBy: options.actor || null,
    })));
    batch.set(loreDoc(firestore, campaignId, V2_COLLECTIONS.loreGroups, sourceGroupId), prepareDocument({
      id: sourceGroupId,
      archivedAt: now,
      archivedBy: options.actor || null,
      mergedInto: targetGroupId,
    }), { merge: true });
    await batch.commit();
  },

  async markDeliveryRead(firestore, campaignId, deliveryId, options = {}) {
    await updateDelivery(firestore, campaignId, deliveryId, markLoreDeliveryRead, options.now);
  },

  async markDeliveryNotified(firestore, campaignId, deliveryId, options = {}) {
    await updateDelivery(firestore, campaignId, deliveryId, markLoreDeliveryNotified, options.now);
  },

  async saveNote(firestore, campaignId, note, options = {}) {
    const normalized = normalizeKnowledgeNote(note, options);
    if (!normalized.actorId || !normalized.targetId) throw new Error("Knowledge note requires actor and target IDs.");
    await setDoc(
      loreDoc(firestore, campaignId, V2_COLLECTIONS.knowledgeNotes, normalized.id),
      prepareDocument({ ...normalized, campaignId })
    );
    return normalized.id;
  },

  async notifyBestiaryReveal(firestore, campaignId, creature, options = {}) {
    const actorSnapshot = await getDocs(collection(firestore, V2_COLLECTIONS.campaigns, campaignId, V2_COLLECTIONS.actors));
    const activePcActorIds = actorSnapshot.docs
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .filter((entry) => entry.kind === "pc" && !entry.deletedAt)
      .map((entry) => entry.id);
    const refs = activePcActorIds.map((actorId) => loreDoc(
      firestore,
      campaignId,
      V2_COLLECTIONS.loreDeliveries,
      createBestiaryRevealDeliveryId(creature.id, actorId)
    ));
    await runTransaction(firestore, async (transaction) => {
      const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
      const deliveries = buildBestiaryRevealDeliveries({
        creatureId: creature.id,
        creatureName: creature.name,
        activePcActorIds,
        existingDeliveries: snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => snapshot.data()),
        actor: options.actor || null,
        now: options.now || new Date().toISOString(),
      });
      deliveries.forEach((delivery) => transaction.set(
        loreDoc(firestore, campaignId, V2_COLLECTIONS.loreDeliveries, delivery.id),
        prepareDocument({ ...delivery, campaignId })
      ));
    });
  },

  async deleteNote(firestore, campaignId, noteOrTarget, actorId = null) {
    const id = typeof noteOrTarget === "string" && !actorId
      ? noteOrTarget
      : noteOrTarget?.id || createKnowledgeNoteId(actorId, noteOrTarget?.targetType, noteOrTarget?.targetId);
    if (!id) return;
    await deleteDoc(loreDoc(firestore, campaignId, V2_COLLECTIONS.knowledgeNotes, id));
  },
};

function loreDoc(firestore, campaignId, collectionName, documentId) {
  return campaignChildDocRef(firestore, campaignId, collectionName, String(documentId));
}

async function updateDelivery(firestore, campaignId, deliveryId, reducer, now) {
  const ref = loreDoc(firestore, campaignId, V2_COLLECTIONS.loreDeliveries, deliveryId);
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error(`Lore delivery not found: ${deliveryId}`);
    transaction.set(ref, prepareDocument(reducer(snapshot.data(), now || new Date().toISOString())));
  });
}

function prepareDocument(value) {
  return cleanForFirestore({ ...value, schemaVersion: V2_SCHEMA_VERSION });
}
