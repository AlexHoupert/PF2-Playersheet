import React from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db as firestore } from "../db/firebase-config.js";
import { V2_COLLECTIONS } from "../db/v2/schema.js";
import {
  materializeLoreSnapshot,
  normalizeKnowledgeNote,
  normalizeLoreArticle,
  normalizeLoreGroup,
} from "./loreModel.js";

const FIRESTORE_CONFIGURED = Boolean(firestore?.app?.options?.projectId);

export function useLoreAdminStore({
  campaignId,
  enabled = true,
  fallbackArticles = [],
  fallbackGroups = [],
  fallbackDeliveries = [],
  fallbackNotes = [],
} = {}) {
  const fallback = React.useMemo(() => buildLoreAdminFallback({
    fallbackArticles,
    fallbackGroups,
    fallbackDeliveries,
    fallbackNotes,
  }), [fallbackArticles, fallbackDeliveries, fallbackGroups, fallbackNotes]);
  const remoteEnabled = Boolean(enabled && FIRESTORE_CONFIGURED && campaignId);
  const [remote, setRemote] = React.useState(() => emptyLoreStore());

  React.useEffect(() => {
    if (!remoteEnabled) return undefined;
    setRemote(emptyLoreStore());
    const unsubscribers = [
      subscribeCollection(campaignId, V2_COLLECTIONS.loreArticles, (articles) => {
        setRemote((current) => ({ ...current, articles: articles.map(normalizeLoreArticle), loading: false }));
      }, setRemote),
      subscribeCollection(campaignId, V2_COLLECTIONS.loreGroups, (groups) => {
        setRemote((current) => ({ ...current, groups: groups.map(normalizeLoreGroup) }));
      }, setRemote),
      subscribeCollection(campaignId, V2_COLLECTIONS.loreDeliveries, (deliveries) => {
        setRemote((current) => ({ ...current, deliveries }));
      }, setRemote),
      subscribeQuery(campaignId, V2_COLLECTIONS.knowledgeNotes, [where("sharedWithGm", "==", true)], (notes) => {
        setRemote((current) => ({ ...current, sharedNotes: notes.map(normalizeKnowledgeNote) }));
      }, setRemote),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [campaignId, remoteEnabled]);

  if (!remoteEnabled) return fallback;
  if (remote.loading || fallback.articles.length === 0) return remote;
  const remoteIds = new Set(remote.articles.map((article) => article.id));
  const missingLegacyArticles = fallback.articles.filter((article) => !remoteIds.has(article.id));
  if (!missingLegacyArticles.length) return remote;
  return {
    ...remote,
    articles: [...remote.articles, ...missingLegacyArticles],
    groups: mergeById(remote.groups, fallback.groups),
    source: remote.articles.length ? "mixed" : "legacy-fallback",
  };
}

export function usePlayerLoreStore({
  campaignId,
  actorId,
  enabled = true,
  fallbackArticles = [],
  fallbackGroups = [],
  fallbackDeliveries = [],
  fallbackNotes = [],
} = {}) {
  const fallback = React.useMemo(() => buildPlayerLoreFallback({
    actorId,
    fallbackArticles,
    fallbackGroups,
    fallbackDeliveries,
    fallbackNotes,
  }), [actorId, fallbackArticles, fallbackDeliveries, fallbackGroups, fallbackNotes]);
  const remoteEnabled = Boolean(enabled && FIRESTORE_CONFIGURED && campaignId && actorId);
  const [remote, setRemote] = React.useState(() => emptyLoreStore());

  React.useEffect(() => {
    if (!remoteEnabled) return undefined;
    setRemote(emptyLoreStore());
    const unsubscribers = [
      subscribeQuery(campaignId, V2_COLLECTIONS.loreDeliveries, [where("actorId", "==", actorId)], (deliveries) => {
        setRemote((current) => ({ ...current, deliveries, loading: false }));
      }, setRemote),
      subscribeCollection(campaignId, V2_COLLECTIONS.loreGroups, (groups) => {
        setRemote((current) => ({ ...current, groups: groups.map(normalizeLoreGroup) }));
      }, setRemote),
      subscribeQuery(campaignId, V2_COLLECTIONS.knowledgeNotes, [where("actorId", "==", actorId)], (notes) => {
        setRemote((current) => ({ ...current, notes: notes.map(normalizeKnowledgeNote) }));
      }, setRemote),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [actorId, campaignId, remoteEnabled]);

  if (!remoteEnabled) return fallback;
  if (remote.loading || fallback.deliveries.length === 0) return remote;
  const remoteArticleIds = new Set(remote.deliveries.map((delivery) => delivery.articleId));
  const missingLegacyDeliveries = fallback.deliveries.filter((delivery) => !remoteArticleIds.has(delivery.articleId));
  if (!missingLegacyDeliveries.length) return remote;
  return {
    ...remote,
    deliveries: [...remote.deliveries, ...missingLegacyDeliveries],
    groups: mergeById(remote.groups, fallback.groups),
    source: remote.deliveries.length ? "mixed" : "legacy-fallback",
  };
}

export function buildLoreAdminFallback({
  fallbackArticles = [],
  fallbackGroups = [],
  fallbackDeliveries = [],
  fallbackNotes = [],
} = {}) {
  const articles = fallbackArticles.map((article) => ({
    ...normalizeLoreArticle(article),
    legacyFallback: true,
  }));
  const groups = fallbackGroups.length ? fallbackGroups.map(normalizeLoreGroup) : inferLegacyLoreGroups(articles);
  return {
    ...emptyLoreStore(),
    articles,
    groups,
    deliveries: fallbackDeliveries,
    sharedNotes: fallbackNotes.filter((note) => note.sharedWithGm).map(normalizeKnowledgeNote),
    loading: false,
    source: "fallback",
  };
}

export function buildPlayerLoreFallback({
  actorId,
  fallbackArticles = [],
  fallbackGroups = [],
  fallbackDeliveries = [],
  fallbackNotes = [],
} = {}) {
  const articles = fallbackArticles.map(normalizeLoreArticle);
  const deliveries = fallbackDeliveries.length
    ? fallbackDeliveries.filter((delivery) => delivery.actorId === actorId)
    : articles.map((article) => ({
      id: `legacy-${article.id}-${actorId}`,
      articleId: article.id,
      actorId,
      version: Math.max(1, article.publication.version),
      attentionVersion: 0,
      readVersion: 0,
      notifiedVersion: 0,
      snapshot: materializeLoreSnapshot(article, actorId),
      legacyFallback: true,
      revokedAt: null,
    }));
  return {
    ...emptyLoreStore(),
    groups: fallbackGroups.length ? fallbackGroups.map(normalizeLoreGroup) : inferLegacyLoreGroups(articles),
    deliveries,
    notes: fallbackNotes.filter((note) => note.actorId === actorId).map(normalizeKnowledgeNote),
    loading: false,
    source: "fallback",
  };
}

function subscribeCollection(campaignId, collectionName, onData, setState) {
  return onSnapshot(
    collection(firestore, V2_COLLECTIONS.campaigns, campaignId, collectionName),
    (snapshot) => onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    (error) => setState((current) => ({ ...current, loading: false, error: error.message || String(error) }))
  );
}

function subscribeQuery(campaignId, collectionName, constraints, onData, setState) {
  return onSnapshot(
    query(collection(firestore, V2_COLLECTIONS.campaigns, campaignId, collectionName), ...constraints),
    (snapshot) => onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    (error) => setState((current) => ({ ...current, loading: false, error: error.message || String(error) }))
  );
}

function inferLegacyLoreGroups(articles) {
  const seen = new Map();
  for (const article of articles) {
    const path = String(article.legacyGroup || "General").split("/").map((part) => part.trim()).filter(Boolean);
    let parentId = null;
    path.forEach((name, index) => {
      const id = `legacy-group-${article.category}-${path.slice(0, index + 1).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      if (!seen.has(id)) {
        seen.set(id, normalizeLoreGroup({ id, name, category: article.category, parentId, sortOrder: seen.size }));
      }
      parentId = id;
    });
    if (!article.groupId) article.groupId = parentId;
  }
  return [...seen.values()];
}

function emptyLoreStore() {
  return {
    articles: [],
    groups: [],
    deliveries: [],
    notes: [],
    sharedNotes: [],
    loading: true,
    error: null,
    source: "firestore",
  };
}

function mergeById(primary, fallback) {
  const seen = new Set(primary.map((entry) => entry.id));
  return [...primary, ...fallback.filter((entry) => !seen.has(entry.id))];
}
