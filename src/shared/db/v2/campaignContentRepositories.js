import { deleteDoc, doc, runTransaction, setDoc } from "firebase/firestore";

import { cleanForFirestore, safeDocId } from "./normalizers.js";
import { V2_COLLECTIONS } from "./schema.js";

function campaignChildRef(firestore, campaignId, collectionName, documentId) {
  return doc(
    firestore,
    V2_COLLECTIONS.campaigns,
    String(campaignId),
    collectionName,
    String(documentId)
  );
}

function stamp(record, timestamp = new Date().toISOString()) {
  return cleanForFirestore({
    ...record,
    schemaVersion: 2,
    updatedAt: record?.updatedAt || timestamp,
  });
}

export const campaignCatalogRepo = {
  async saveEntryWithEvent(firestore, campaignId, entry, event) {
    const entryRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogEntries, entry.id);
    const eventRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogChangeEvents, event.id);
    await runTransaction(firestore, async transaction => {
      const snapshot = await transaction.get(entryRef);
      const before = snapshot.exists() ? snapshot.data() : null;
      const next = stamp(entry, event.createdAt);
      transaction.set(entryRef, next);
      transaction.set(eventRef, stamp({ ...event, before, after: next }, event.createdAt));
    });
  },

  async deleteEntryWithEvent(firestore, campaignId, entryId, event) {
    const entryRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogEntries, entryId);
    const eventRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogChangeEvents, event.id);
    await runTransaction(firestore, async transaction => {
      const snapshot = await transaction.get(entryRef);
      if (!snapshot.exists()) throw new Error(`Campaign catalog entry not found: ${entryId}`);
      const before = snapshot.data();
      transaction.delete(entryRef);
      transaction.set(eventRef, stamp({ ...event, before, after: null }, event.createdAt));
    });
  },

  async revertEvent(firestore, campaignId, eventId, revertEvent) {
    const sourceEventRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogChangeEvents, eventId);
    const revertEventRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogChangeEvents, revertEvent.id);
    await runTransaction(firestore, async transaction => {
      const sourceSnapshot = await transaction.get(sourceEventRef);
      if (!sourceSnapshot.exists()) throw new Error(`Catalog change event not found: ${eventId}`);
      const sourceEvent = sourceSnapshot.data();
      if (sourceEvent.revertedAt) throw new Error("Catalog change has already been reverted");
      const entryId = sourceEvent.entryId;
      const entryRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.catalogEntries, entryId);
      const currentSnapshot = await transaction.get(entryRef);
      const current = currentSnapshot.exists() ? currentSnapshot.data() : null;
      if (sourceEvent.before) transaction.set(entryRef, stamp(sourceEvent.before, revertEvent.createdAt));
      else if (currentSnapshot.exists()) transaction.delete(entryRef);
      transaction.update(sourceEventRef, stamp({
        revertedAt: revertEvent.createdAt,
        revertedBy: revertEvent.actorEmail,
        revertedByEventId: revertEvent.id,
      }, revertEvent.createdAt));
      transaction.set(revertEventRef, stamp({
        ...revertEvent,
        entryId,
        catalogType: sourceEvent.catalogType,
        before: current,
        after: sourceEvent.before || null,
        revertsEventId: eventId,
      }, revertEvent.createdAt));
    });
  },

  async promoteEntryWithEvent(firestore, campaignId, globalOverride, event) {
    const overrideRef = doc(
      firestore,
      V2_COLLECTIONS.catalogOverrides,
      safeDocId(globalOverride.id, "catalog_override")
    );
    const eventRef = campaignChildRef(
      firestore,
      campaignId,
      V2_COLLECTIONS.catalogChangeEvents,
      event.id
    );
    await runTransaction(firestore, async transaction => {
      const currentSnapshot = await transaction.get(overrideRef);
      const before = currentSnapshot.exists() ? currentSnapshot.data() : null;
      const after = stamp(globalOverride, event.createdAt);
      transaction.set(overrideRef, after);
      transaction.set(eventRef, stamp({ ...event, before, after }, event.createdAt));
    });
  },
};

export const effectRequestRepo = {
  async createRequest(firestore, campaignId, request) {
    const requestRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.effectRequests, request.id);
    await runTransaction(firestore, async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (snapshot.exists() && snapshot.data()?.status === "pending") {
        throw new Error("This effect request is already pending");
      }
      transaction.set(requestRef, stamp(request, request.createdAt));
    });
  },

  async rejectRequest(firestore, campaignId, requestId, decision) {
    const requestRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.effectRequests, requestId);
    await runTransaction(firestore, async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists()) throw new Error(`Effect request not found: ${requestId}`);
      const current = snapshot.data();
      if (current.status !== "pending") throw new Error("Effect request has already been decided");
      transaction.set(requestRef, stamp({ ...current, ...decision, status: "rejected" }, decision.decidedAt));
    });
  },

  async approveRequest(firestore, campaignId, requestId, resolver) {
    const requestRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.effectRequests, requestId);
    await runTransaction(firestore, async transaction => {
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists()) throw new Error(`Effect request not found: ${requestId}`);
      const request = requestSnapshot.data();
      if (request.status !== "pending") throw new Error("Effect request has already been decided");

      const sourceActorRef = request.sourceActorId
        ? campaignChildRef(firestore, campaignId, V2_COLLECTIONS.actors, request.sourceActorId)
        : null;
      const sourceActorSnapshot = sourceActorRef ? await transaction.get(sourceActorRef) : null;
      if (sourceActorRef && !sourceActorSnapshot?.exists()) {
        throw new Error(`Source actor not found: ${request.sourceActorId}`);
      }

      const result = resolver(request, sourceActorSnapshot?.data() || null);
      if (sourceActorRef && result.sourceActor) {
        transaction.set(sourceActorRef, stamp(result.sourceActor, result.decidedAt));
      }
      for (const effect of result.effects || []) {
        const effectRef = campaignChildRef(firestore, campaignId, V2_COLLECTIONS.actorEffects, effect.id);
        transaction.set(effectRef, stamp(effect, result.decidedAt));
      }
      transaction.set(requestRef, stamp({
        ...request,
        status: "approved",
        decidedAt: result.decidedAt,
        decidedBy: result.decidedBy,
        createdEffectIds: (result.effects || []).map(effect => effect.id),
      }, result.decidedAt));
    });
  },
};

export const loreContributionRepo = {
  async setContribution(firestore, campaignId, contribution) {
    const id = safeDocId(contribution?.id || contribution?.title, "lore_contribution");
    await setDoc(
      campaignChildRef(firestore, campaignId, V2_COLLECTIONS.loreContributions, id),
      stamp({ ...contribution, id })
    );
    return id;
  },

  async deleteContribution(firestore, campaignId, contributionId) {
    await deleteDoc(campaignChildRef(
      firestore,
      campaignId,
      V2_COLLECTIONS.loreContributions,
      safeDocId(contributionId, "lore_contribution")
    ));
  },

  async promoteContribution(firestore, campaignId, contribution, article) {
    const contributionRef = campaignChildRef(
      firestore,
      campaignId,
      V2_COLLECTIONS.loreContributions,
      safeDocId(contribution.id, "lore_contribution")
    );
    const articleRef = campaignChildRef(
      firestore,
      campaignId,
      V2_COLLECTIONS.loreArticles,
      safeDocId(article.id, "lore_article")
    );
    await runTransaction(firestore, async transaction => {
      const contributionSnapshot = await transaction.get(contributionRef);
      if (!contributionSnapshot.exists()) throw new Error(`Lore contribution not found: ${contribution.id}`);
      if (contributionSnapshot.data()?.status !== "active") {
        throw new Error("Only active contributions can be promoted");
      }
      transaction.set(articleRef, stamp({ ...article, campaignId }));
      transaction.set(contributionRef, stamp({ ...contribution, campaignId }));
    });
  },
};
