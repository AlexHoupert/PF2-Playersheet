export const LORE_CATEGORIES = Object.freeze([
  { id: "history", label: "History" },
  { id: "locations", label: "Locations" },
  { id: "npcs", label: "NPCs" },
  { id: "bestiary", label: "Bestiary" },
  { id: "other", label: "Other" },
]);

export const LORE_CATEGORY_IDS = Object.freeze(LORE_CATEGORIES.map((entry) => entry.id));

export const LORE_PUBLICATION_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  RETRACTED: "retracted",
});

export const LORE_AUDIENCE_MODES = Object.freeze({
  PARTY: "party",
  ACTORS: "actors",
  INHERIT: "inherit",
  GM: "gm",
});

export function normalizeLoreCategory(value) {
  const normalized = String(value || "other").trim().toLowerCase();
  return LORE_CATEGORY_IDS.includes(normalized) ? normalized : "other";
}

export function getLoreCategoryLabel(category) {
  return LORE_CATEGORIES.find((entry) => entry.id === normalizeLoreCategory(category))?.label || "Other";
}

export function createLoreArticleDraft(input = {}, options = {}) {
  const createId = options.createId || defaultCreateId;
  const now = options.now || new Date().toISOString();
  const actor = options.actor || null;
  const id = String(input.id || createId("lore"));
  return normalizeLoreArticle({
    ...input,
    id,
    publication: input.publication || {
      status: LORE_PUBLICATION_STATUS.DRAFT,
      version: 0,
      attentionVersion: 0,
      audience: { mode: LORE_AUDIENCE_MODES.PARTY, actorIds: [] },
    },
    createdAt: input.createdAt || now,
    createdBy: input.createdBy || actor,
    updatedAt: input.updatedAt || now,
    updatedBy: input.updatedBy || actor,
  }, { createId });
}

export function normalizeLoreArticle(article = {}, options = {}) {
  const createId = options.createId || defaultCreateId;
  const id = String(article.id || createId("lore"));
  const legacyContent = String(article.content || "");
  const bodyBlocks = Array.isArray(article.bodyBlocks) && article.bodyBlocks.length
    ? article.bodyBlocks.map((block) => normalizeLoreBodyBlock(block, { createId }))
    : [normalizeLoreBodyBlock({ type: "content", content: legacyContent }, { createId })];
  const publication = normalizeLorePublication(article.publication, article.publishedSnapshot);
  const links = normalizeLoreReferences(
    Array.isArray(article.links) && article.links.length
      ? article.links
      : extractLoreReferences(bodyBlocks.map((block) => block.content).join("\n"))
  );

  return stripUndefined({
    ...article,
    id,
    title: String(article.title || "Untitled article").trim() || "Untitled article",
    category: normalizeLoreCategory(article.category),
    groupId: article.groupId ? String(article.groupId) : null,
    legacyGroup: article.legacyGroup || article.group || null,
    tags: normalizeStringList(article.tags),
    image: article.image || null,
    bodyBlocks,
    infobox: normalizeLoreInfobox(article.infobox),
    categoryData: isPlainObject(article.categoryData) ? { ...article.categoryData } : {},
    links,
    publication,
    publishedSnapshot: article.publishedSnapshot || null,
    deletedAt: article.deletedAt || null,
    deletedBy: article.deletedBy || null,
  });
}

export function normalizeLoreBodyBlock(block = {}, options = {}) {
  const createId = options.createId || defaultCreateId;
  const type = block.type === "reveal" ? "reveal" : "content";
  return {
    id: String(block.id || createId("block")),
    type,
    content: String(block.content || ""),
    audience: type === "reveal"
      ? normalizeLoreAudience(block.audience, { allowInherit: true, allowGm: true })
      : { mode: LORE_AUDIENCE_MODES.INHERIT, actorIds: [] },
  };
}

export function normalizeLorePublication(publication = {}, publishedSnapshot = null) {
  const hasPublishedSnapshot = Boolean(publishedSnapshot);
  const version = Math.max(0, toInteger(publication?.version, hasPublishedSnapshot ? 1 : 0));
  const attentionVersion = Math.max(0, Math.min(version, toInteger(publication?.attentionVersion, 0)));
  const status = Object.values(LORE_PUBLICATION_STATUS).includes(publication?.status)
    ? publication.status
    : hasPublishedSnapshot
      ? LORE_PUBLICATION_STATUS.PUBLISHED
      : LORE_PUBLICATION_STATUS.DRAFT;
  return {
    status,
    version,
    attentionVersion,
    audience: normalizeLoreAudience(publication?.audience),
    publishedAt: publication?.publishedAt || null,
    publishedBy: publication?.publishedBy || null,
  };
}

export function normalizeLoreAudience(audience = {}, options = {}) {
  const allowInherit = Boolean(options.allowInherit);
  const allowGm = Boolean(options.allowGm);
  const allowedModes = [LORE_AUDIENCE_MODES.PARTY, LORE_AUDIENCE_MODES.ACTORS];
  if (allowInherit) allowedModes.push(LORE_AUDIENCE_MODES.INHERIT);
  if (allowGm) allowedModes.push(LORE_AUDIENCE_MODES.GM);
  const mode = allowedModes.includes(audience?.mode) ? audience.mode : allowedModes[0];
  return {
    mode,
    actorIds: mode === LORE_AUDIENCE_MODES.ACTORS ? normalizeStringList(audience?.actorIds) : [],
  };
}

export function normalizeLoreInfobox(value) {
  if (Array.isArray(value)) {
    return value
      .map((row, index) => ({
        id: String(row?.id || `infobox-${index}`),
        label: String(row?.label || row?.key || "").trim(),
        value: String(row?.value || "").trim(),
      }))
      .filter((row) => row.label || row.value);
  }
  return String(value || "")
    .split("\n")
    .map((line, index) => {
      const separator = line.indexOf(":");
      if (separator < 0) return null;
      return {
        id: `infobox-${index}`,
        label: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    })
    .filter(Boolean);
}

export function normalizeLoreGroup(group = {}, options = {}) {
  const createId = options.createId || defaultCreateId;
  return stripUndefined({
    ...group,
    id: String(group.id || createId("lore-group")),
    name: String(group.name || "New group").trim() || "New group",
    category: normalizeLoreCategory(group.category),
    parentId: group.parentId ? String(group.parentId) : null,
    sortOrder: toFiniteNumber(group.sortOrder, 0),
    archivedAt: group.archivedAt || null,
    archivedBy: group.archivedBy || null,
  });
}

export function normalizeKnowledgeNote(note = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const actorId = String(note.actorId || "");
  const targetType = note.targetType === "creature" ? "creature" : "loreArticle";
  const targetId = String(note.targetId || "");
  return stripUndefined({
    ...note,
    id: String(note.id || createKnowledgeNoteId(actorId, targetType, targetId)),
    actorId,
    targetType,
    targetId,
    content: String(note.content || ""),
    sharedWithGm: Boolean(note.sharedWithGm),
    createdAt: note.createdAt || now,
    updatedAt: now,
  });
}

export function createKnowledgeNoteId(actorId, targetType, targetId) {
  return [actorId, targetType, targetId].map(encodeIdPart).join("__");
}

export function createLoreDeliveryId(articleId, actorId) {
  return [articleId, actorId].map(encodeIdPart).join("__");
}

export function createBestiaryRevealDeliveryId(creatureId, actorId) {
  return ["bestiary", creatureId, actorId].map(encodeIdPart).join("__");
}

export function buildBestiaryRevealDeliveries({
  creatureId,
  creatureName,
  activePcActorIds = [],
  existingDeliveries = [],
  actor = null,
  now = new Date().toISOString(),
} = {}) {
  if (!creatureId) throw new Error("Bestiary notification requires a creature ID.");
  const existingByActor = new Map((existingDeliveries || []).map((delivery) => [String(delivery.actorId), delivery]));
  const nextVersion = Math.max(0, ...(existingDeliveries || []).map((delivery) => toInteger(delivery.version, 0))) + 1;
  return normalizeStringList(activePcActorIds).map((actorId) => {
    const current = existingByActor.get(actorId) || {};
    return {
      ...current,
      id: current.id || createBestiaryRevealDeliveryId(creatureId, actorId),
      deliveryKind: "bestiaryReveal",
      articleId: null,
      actorId,
      referenceType: "creature",
      referenceId: String(creatureId),
      version: nextVersion,
      attentionVersion: nextVersion,
      readVersion: Math.min(nextVersion, Math.max(0, toInteger(current.readVersion, 0))),
      notifiedVersion: Math.min(nextVersion, Math.max(0, toInteger(current.notifiedVersion, 0))),
      snapshot: {
        articleId: null,
        creatureId: String(creatureId),
        title: String(creatureName || "Bestiary updated"),
        category: "bestiary",
        groupId: null,
        tags: [],
        image: null,
        bodyBlocks: [],
        infobox: [],
        categoryData: {},
        links: [],
      },
      publishedAt: now,
      publishedBy: actor,
      revokedAt: null,
      revokedBy: null,
    };
  });
}

export function materializeLoreSnapshot(article, actorId) {
  const normalized = normalizeLoreArticle(article);
  const bodyBlocks = normalized.bodyBlocks.filter((block) => isLoreBlockVisibleToActor(block, actorId));
  return {
    articleId: normalized.id,
    title: normalized.title,
    category: normalized.category,
    groupId: normalized.groupId,
    tags: [...normalized.tags],
    image: normalized.image,
    bodyBlocks,
    infobox: normalized.infobox.map((row) => ({ ...row })),
    categoryData: { ...normalized.categoryData },
    links: normalizeLoreReferences(extractLoreReferences([
      ...bodyBlocks.map((block) => block.content),
      ...normalized.infobox.map((row) => row.value),
    ].join("\n"))),
  };
}

export function isLoreBlockVisibleToActor(block, actorId) {
  if (block?.type !== "reveal") return true;
  const audience = normalizeLoreAudience(block.audience, { allowInherit: true, allowGm: true });
  if (audience.mode === LORE_AUDIENCE_MODES.GM) return false;
  if (audience.mode === LORE_AUDIENCE_MODES.ACTORS) return audience.actorIds.includes(String(actorId));
  return true;
}

export function resolveLoreAudienceActorIds(audience, activePcActorIds = []) {
  const normalized = normalizeLoreAudience(audience);
  const activeIds = new Set(normalizeStringList(activePcActorIds));
  if (normalized.mode === LORE_AUDIENCE_MODES.ACTORS) {
    return normalized.actorIds.filter((actorId) => activeIds.has(actorId));
  }
  return [...activeIds];
}

export function publishLoreArticle({
  article,
  activePcActorIds = [],
  existingDeliveries = [],
  audience = null,
  notify = false,
  actor = null,
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeLoreArticle(article);
  const nextAudience = normalizeLoreAudience(audience || normalized.publication.audience);
  const targetActorIds = resolveLoreAudienceActorIds(nextAudience, activePcActorIds);
  const targetSet = new Set(targetActorIds);
  const existingByActor = new Map(
    (existingDeliveries || [])
      .filter((delivery) => delivery?.actorId)
      .map((delivery) => [String(delivery.actorId), delivery])
  );
  const version = normalized.publication.version + 1;
  const attentionVersion = notify ? version : normalized.publication.attentionVersion;
  const publication = {
    status: LORE_PUBLICATION_STATUS.PUBLISHED,
    version,
    attentionVersion,
    audience: nextAudience,
    publishedAt: now,
    publishedBy: actor,
  };
  const publishedSnapshot = {
    title: normalized.title,
    category: normalized.category,
    groupId: normalized.groupId,
    tags: [...normalized.tags],
    image: normalized.image,
    bodyBlocks: normalized.bodyBlocks.map((block) => ({ ...block, audience: { ...block.audience } })),
    infobox: normalized.infobox.map((row) => ({ ...row })),
    categoryData: { ...normalized.categoryData },
    links: normalized.links.map((link) => ({ ...link })),
  };
  const nextArticle = {
    ...normalized,
    publication,
    publishedSnapshot,
    updatedAt: now,
    updatedBy: actor,
  };
  const deliveries = targetActorIds.map((actorId) => {
    const current = existingByActor.get(actorId) || {};
    return {
      ...current,
      id: current.id || createLoreDeliveryId(normalized.id, actorId),
      articleId: normalized.id,
      actorId,
      version,
      attentionVersion,
      readVersion: Math.min(version, Math.max(0, toInteger(current.readVersion, 0))),
      notifiedVersion: Math.min(attentionVersion, Math.max(0, toInteger(current.notifiedVersion, 0))),
      snapshot: materializeLoreSnapshot(nextArticle, actorId),
      publishedAt: now,
      revokedAt: null,
      revokedBy: null,
    };
  });
  const revokedDeliveries = [...existingByActor.values()]
    .filter((delivery) => !targetSet.has(String(delivery.actorId)) && !delivery.revokedAt)
    .map((delivery) => ({
      ...delivery,
      revokedAt: now,
      revokedBy: actor,
    }));

  return { article: nextArticle, deliveries, revokedDeliveries, targetActorIds };
}

export function retractLoreArticle({
  article,
  existingDeliveries = [],
  actor = null,
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeLoreArticle(article);
  return {
    article: {
      ...normalized,
      publication: {
        ...normalized.publication,
        status: LORE_PUBLICATION_STATUS.RETRACTED,
      },
      updatedAt: now,
      updatedBy: actor,
    },
    deliveries: (existingDeliveries || []).map((delivery) => ({
      ...delivery,
      revokedAt: delivery.revokedAt || now,
      revokedBy: actor,
    })),
  };
}

export function markLoreDeliveryRead(delivery, now = new Date().toISOString()) {
  const attentionVersion = Math.max(0, toInteger(delivery?.attentionVersion, 0));
  return {
    ...delivery,
    readVersion: Math.max(toInteger(delivery?.readVersion, 0), attentionVersion),
    notifiedVersion: Math.max(toInteger(delivery?.notifiedVersion, 0), attentionVersion),
    readAt: now,
    updatedAt: now,
  };
}

export function markLoreDeliveryNotified(delivery, now = new Date().toISOString()) {
  const attentionVersion = Math.max(0, toInteger(delivery?.attentionVersion, 0));
  return {
    ...delivery,
    notifiedVersion: Math.max(toInteger(delivery?.notifiedVersion, 0), attentionVersion),
    notifiedAt: now,
    updatedAt: now,
  };
}

export function isLoreDeliveryUnread(delivery) {
  return !delivery?.revokedAt && toInteger(delivery?.attentionVersion, 0) > toInteger(delivery?.readVersion, 0);
}

export function doesLoreDeliveryNeedPopup(delivery) {
  return !delivery?.revokedAt && toInteger(delivery?.attentionVersion, 0) > toInteger(delivery?.notifiedVersion, 0);
}

export function extractLoreReferences(content) {
  const references = [];
  const pattern = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = pattern.exec(String(content || "")))) {
    const parsed = parseLoreReference(match[1]);
    if (parsed) references.push(parsed);
  }
  return normalizeLoreReferences(references);
}

export function parseLoreReference(inner) {
  const [rawTarget, ...labelParts] = String(inner || "").split("|");
  const target = rawTarget.trim();
  const label = (labelParts.join("|").trim() || target).trim();
  const stableMatch = target.match(/^(lore|creature):(.+)$/i);
  if (stableMatch) {
    return { type: stableMatch[1].toLowerCase(), id: stableMatch[2].trim(), label };
  }
  if (!target) return null;
  return { type: "legacyTitle", id: target, label };
}

export function normalizeLoreReferences(references = []) {
  const seen = new Set();
  const result = [];
  for (const reference of references || []) {
    const parsed = typeof reference === "string" ? parseLoreReference(reference) : reference;
    if (!parsed?.id) continue;
    const normalized = {
      type: ["lore", "creature", "legacyTitle"].includes(parsed.type) ? parsed.type : "lore",
      id: String(parsed.id),
      label: String(parsed.label || parsed.id),
    };
    const key = `${normalized.type}:${normalized.id}:${normalized.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function convertLegacyLoreLinks(content, articles = []) {
  const titleBuckets = new Map();
  for (const article of articles || []) {
    const titleKey = String(article?.title || "").trim().toLowerCase();
    if (!titleKey || !article?.id) continue;
    const bucket = titleBuckets.get(titleKey) || [];
    bucket.push(article);
    titleBuckets.set(titleKey, bucket);
  }
  const report = { converted: [], ambiguous: [], broken: [] };
  const nextContent = String(content || "").replace(/\[\[([^\]]+)\]\]/g, (full, inner) => {
    const reference = parseLoreReference(inner);
    if (!reference || reference.type !== "legacyTitle") return full;
    const matches = titleBuckets.get(reference.id.toLowerCase()) || [];
    if (matches.length === 1) {
      const replacement = `[[lore:${matches[0].id}|${reference.label}]]`;
      report.converted.push({ source: full, replacement, articleId: matches[0].id });
      return replacement;
    }
    const target = { source: full, title: reference.id, matches: matches.map((entry) => entry.id) };
    if (matches.length > 1) report.ambiguous.push(target);
    else report.broken.push(target);
    return full;
  });
  return { content: nextContent, report };
}

function normalizeStringList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))];
}

function toInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function defaultCreateId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function encodeIdPart(value) {
  return encodeURIComponent(String(value || "")).replaceAll("%", "_");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)])
  );
}
