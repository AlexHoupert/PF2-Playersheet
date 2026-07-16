import {
  doesLoreDeliveryNeedPopup,
  getLoreCategoryLabel,
  isLoreDeliveryUnread,
  normalizeKnowledgeNote,
  normalizeLoreArticle,
  normalizeLoreCategory,
  normalizeLoreGroup,
} from "./loreModel.js";

export function selectActiveLoreArticles(articles = []) {
  return (articles || [])
    .map((article) => normalizeLoreArticle(article))
    .filter((article) => !article.deletedAt)
    .sort(sortLoreArticles);
}

export function selectArchivedLoreArticles(articles = []) {
  return (articles || [])
    .map((article) => normalizeLoreArticle(article))
    .filter((article) => Boolean(article.deletedAt))
    .sort(sortLoreArticles);
}

export function selectActiveLoreGroups(groups = []) {
  return (groups || [])
    .map((group) => normalizeLoreGroup(group))
    .filter((group) => !group.archivedAt)
    .sort(sortLoreGroups);
}

export function buildLoreGroupTree(groups = [], category = null) {
  const normalizedCategory = category ? normalizeLoreCategory(category) : null;
  const records = selectActiveLoreGroups(groups)
    .filter((group) => !normalizedCategory || group.category === normalizedCategory);
  const byId = new Map(records.map((group) => [group.id, { ...group, children: [] }]));
  const roots = [];
  for (const group of byId.values()) {
    const parent = group.parentId ? byId.get(group.parentId) : null;
    if (parent && parent.id !== group.id) parent.children.push(group);
    else roots.push(group);
  }
  const sortTree = (nodes) => nodes.sort(sortLoreGroups).map((node) => ({
    ...node,
    children: sortTree(node.children),
  }));
  return sortTree(roots);
}

export function selectVisibleLoreDeliveries(deliveries = [], category = null) {
  const normalizedCategory = category ? normalizeLoreCategory(category) : null;
  return (deliveries || [])
    .filter((delivery) => delivery && !delivery.revokedAt && delivery.snapshot)
    .filter((delivery) => !normalizedCategory || normalizeLoreCategory(delivery.snapshot.category) === normalizedCategory)
    .sort((a, b) => sortLoreSnapshots(a.snapshot, b.snapshot));
}

export function selectLoreDeliveryByArticleId(deliveries = [], articleId) {
  return (deliveries || []).find((delivery) => !delivery?.revokedAt && delivery.articleId === articleId) || null;
}

export function selectOwnKnowledgeNote(notes = [], actorId, targetType, targetId) {
  return (notes || [])
    .map((note) => normalizeKnowledgeNote(note, {
      now: note?.updatedAt || note?.createdAt || "1970-01-01T00:00:00.000Z",
    }))
    .find((note) => note.actorId === String(actorId || "")
      && note.targetType === targetType
      && note.targetId === String(targetId || "")) || null;
}

export function selectPartyKnowledgeNotes(notes = [], actorId, targetType, targetId) {
  const ownerId = String(actorId || "");
  return (notes || [])
    .map(normalizeKnowledgeNote)
    .filter((note) => note.sharedWithParty
      && note.actorId !== ownerId
      && note.targetType === targetType
      && note.targetId === String(targetId || "")
      && note.content.trim())
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
      || left.id.localeCompare(right.id));
}

export function buildKnowledgeNoteViewModels({
  notes = [],
  deliveries = [],
  groups = [],
  visibleCreatures = [],
  actors = [],
} = {}) {
  const deliveryByArticleId = new Map(
    (deliveries || [])
      .filter((delivery) => delivery?.articleId && !delivery.revokedAt && delivery.snapshot)
      .map((delivery) => [String(delivery.articleId), delivery])
  );
  const creatureById = new Map(
    (visibleCreatures || [])
      .filter((creature) => creature?.id)
      .map((creature) => [String(creature.id), creature])
  );
  const groupById = new Map(selectActiveLoreGroups(groups).map((group) => [group.id, group]));
  const actorById = new Map((actors || []).filter((actor) => actor?.id).map((actor) => [String(actor.id), actor]));

  return (notes || [])
    .map((note) => normalizeKnowledgeNote(note, {
      now: note?.updatedAt || note?.createdAt || "1970-01-01T00:00:00.000Z",
    }))
    .map((note) => buildKnowledgeNoteViewModel(note, {
      deliveryByArticleId,
      creatureById,
      groupById,
      actorById,
    }))
    .sort(compareKnowledgeNotesByUpdatedAt);
}

export function filterKnowledgeNoteViewModels(viewModels = [], filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const targetType = filters.targetType || "all";
  const category = filters.category || "all";
  const sharing = filters.sharing || "all";
  const availability = filters.availability || "all";
  const sortBy = filters.sortBy || "updated-desc";

  return (viewModels || [])
    .filter((note) => targetType === "all" || note.targetType === targetType)
    .filter((note) => category === "all" || note.category === category)
    .filter((note) => sharing === "all" || note.sharingState === sharing)
    .filter((note) => availability === "all"
      || (availability === "available" ? note.targetAccessible : !note.targetAccessible))
    .filter((note) => !query || note.searchText.includes(query))
    .sort(getKnowledgeNoteComparator(sortBy));
}

export function getKnowledgeNoteSharingState(note = {}) {
  if (note.sharedWithGm && note.sharedWithParty) return "gm-party";
  if (note.sharedWithGm) return "gm";
  if (note.sharedWithParty) return "party";
  return "private";
}

export function selectLoreAttention(deliveries = []) {
  const byCategory = {};
  const popupDeliveries = [];
  let total = 0;
  for (const delivery of selectVisibleLoreDeliveries(deliveries)) {
    const category = normalizeLoreCategory(delivery.snapshot?.category);
    if (isLoreDeliveryUnread(delivery)) {
      byCategory[category] = (byCategory[category] || 0) + 1;
      total += 1;
    }
    if (doesLoreDeliveryNeedPopup(delivery)) popupDeliveries.push(delivery);
  }
  popupDeliveries.sort((a, b) => Date.parse(a.publishedAt || 0) - Date.parse(b.publishedAt || 0));
  return { total, byCategory, popupDeliveries };
}

export function buildLoreAlertsByPage(deliveries = [], existing = {}) {
  const attention = selectLoreAttention(deliveries);
  const next = { ...existing };
  for (const [category, count] of Object.entries(attention.byCategory)) {
    next[`knowledge.${category}`] = count;
  }
  next.knowledge = attention.total;
  return next;
}

export function searchLoreDeliveries(deliveries = [], groups = [], query = "", category = null) {
  const needle = String(query || "").trim().toLowerCase();
  const groupById = new Map(selectActiveLoreGroups(groups).map((group) => [group.id, group]));
  return selectVisibleLoreDeliveries(deliveries, category).filter((delivery) => {
    if (!needle) return true;
    const snapshot = delivery.snapshot || {};
    return buildLoreSearchText(snapshot, groupById).includes(needle);
  });
}

export function searchLoreArticles(articles = [], query = "", groups = []) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return (articles || []).map((article) => normalizeLoreArticle(article));
  const groupById = new Map(selectActiveLoreGroups(groups).map((group) => [group.id, group]));
  return (articles || []).map((article) => normalizeLoreArticle(article)).filter((article) => {
    return buildLoreSearchText(article, groupById).includes(needle);
  });
}

export function selectLoreBacklinks(articlesOrSnapshots = [], targetType, targetId) {
  return (articlesOrSnapshots || []).filter((entry) => {
    const source = entry.snapshot || entry;
    return (source.links || []).some((link) => link.type === targetType && link.id === targetId);
  });
}

export function validateLoreLinks(article, availableLoreIds = [], availableCreatureIds = []) {
  const loreIds = new Set(availableLoreIds);
  const creatureIds = new Set(availableCreatureIds);
  const links = normalizeLoreArticle(article).links;
  return links.map((link) => ({
    ...link,
    valid: link.type === "lore"
      ? loreIds.has(link.id)
      : link.type === "creature"
        ? creatureIds.has(link.id)
        : false,
  }));
}

export function sortLoreArticles(a, b) {
  return normalizeLoreCategory(a.category).localeCompare(normalizeLoreCategory(b.category))
    || Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
    || String(a.title || "").localeCompare(String(b.title || ""));
}

function sortLoreSnapshots(a, b) {
  return normalizeLoreCategory(a?.category).localeCompare(normalizeLoreCategory(b?.category))
    || String(a?.title || "").localeCompare(String(b?.title || ""));
}

function sortLoreGroups(a, b) {
  return Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
    || String(a.name || "").localeCompare(String(b.name || ""));
}

function buildLoreSearchText(entry, groupById) {
  return [
    entry.title,
    getLoreCategoryLabel(entry.category),
    ...selectLoreGroupPath(entry.groupId, groupById),
    ...(entry.tags || []),
    ...(entry.bodyBlocks || []).map((block) => block.content),
    ...(entry.infobox || []).flatMap((row) => [row.label, row.value]),
    ...(entry.links || []).flatMap((link) => [link.label, link.id]),
    ...Object.values(entry.categoryData || {}),
  ].join(" ").toLowerCase();
}

function selectLoreGroupPath(groupId, groupById) {
  const names = [];
  const visited = new Set();
  let current = groupId ? groupById.get(groupId) : null;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.push(current.name);
    current = current.parentId ? groupById.get(current.parentId) : null;
  }
  return names;
}

function buildKnowledgeNoteViewModel(note, context) {
  const isCreature = note.targetType === "creature";
  const delivery = isCreature ? null : context.deliveryByArticleId.get(note.targetId);
  const creature = isCreature ? context.creatureById.get(note.targetId) : null;
  const currentTarget = isCreature ? creature : delivery?.snapshot;
  const targetAccessible = Boolean(currentTarget);
  const fallback = note.targetSnapshot || {};
  const category = isCreature
    ? "bestiary"
    : normalizeLoreCategory(currentTarget?.category || fallback.category);
  const targetTitle = String(
    currentTarget?.title
      || currentTarget?.name
      || fallback.title
      || (isCreature ? "Unavailable Bestiary entry" : "Unavailable Lore entry")
  );
  const groupId = isCreature ? null : currentTarget?.groupId || null;
  const groupPath = groupId ? selectLoreGroupPath(groupId, context.groupById).reverse() : [];
  const owner = context.actorById.get(note.actorId);
  const sharingState = getKnowledgeNoteSharingState(note);
  const navigationCommand = targetAccessible
    ? isCreature
      ? { type: "creature", targetId: note.targetId }
      : { type: "loreArticle", targetId: note.targetId, category }
    : null;
  const categoryLabel = getLoreCategoryLabel(category);

  return {
    id: note.id,
    note,
    actorId: note.actorId,
    ownerName: owner?.name || "Unknown actor",
    content: note.content,
    excerpt: buildKnowledgeNoteExcerpt(note.content),
    targetType: note.targetType,
    targetId: note.targetId,
    targetTitle,
    targetImage: currentTarget?.image || fallback.image || null,
    targetAccessible,
    category,
    categoryLabel,
    groupId,
    groupPath,
    groupLabel: groupPath.join(" / "),
    sharedWithGm: note.sharedWithGm,
    sharedWithParty: note.sharedWithParty,
    sharingState,
    createdAt: note.createdAt || null,
    updatedAt: note.updatedAt || note.createdAt || null,
    navigationCommand,
    searchText: [
      note.content,
      targetTitle,
      categoryLabel,
      ...groupPath,
      owner?.name,
    ].filter(Boolean).join(" ").toLowerCase(),
  };
}

function buildKnowledgeNoteExcerpt(content) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  return normalized.length > 150 ? `${normalized.slice(0, 147).trimEnd()}...` : normalized;
}

function compareKnowledgeNotesByUpdatedAt(left, right) {
  return compareDateDescending(left.updatedAt, right.updatedAt) || left.id.localeCompare(right.id);
}

function getKnowledgeNoteComparator(sortBy) {
  if (sortBy === "created-desc") {
    return (left, right) => compareDateDescending(left.createdAt, right.createdAt) || left.id.localeCompare(right.id);
  }
  if (sortBy === "title-asc") {
    return (left, right) => left.targetTitle.localeCompare(right.targetTitle) || compareKnowledgeNotesByUpdatedAt(left, right);
  }
  if (sortBy === "category-asc") {
    return (left, right) => left.categoryLabel.localeCompare(right.categoryLabel)
      || left.targetTitle.localeCompare(right.targetTitle)
      || compareKnowledgeNotesByUpdatedAt(left, right);
  }
  return compareKnowledgeNotesByUpdatedAt;
}

function compareDateDescending(left, right) {
  const leftTime = Date.parse(left || "");
  const rightTime = Date.parse(right || "");
  const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
  return safeRight - safeLeft;
}
