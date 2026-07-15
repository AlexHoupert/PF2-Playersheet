import {
  convertLegacyLoreLinks,
  createLoreDeliveryId,
  materializeLoreSnapshot,
  normalizeLoreArticle,
} from "../lore/loreModel.js";

export function buildLoreMigrationPlan({
  campaignId,
  legacyArticles = [],
  activePcActorIds = [],
  now = new Date().toISOString(),
  actor = "lore-migration",
} = {}) {
  if (!campaignId) throw new Error("Lore migration requires a campaignId.");
  const sourceArticles = legacyArticles.map((article) => normalizeLoreArticle(article, {
    createId: deterministicIdFactory(article?.id || article?.title || "article"),
  }));
  const groups = buildMigratedLoreGroups(sourceArticles, campaignId, now, actor);
  const groupIdByPath = new Map(groups.map((group) => [group.legacyPathKey, group.id]));
  const linkReport = { converted: [], ambiguous: [], broken: [] };

  const articles = sourceArticles.map((article) => {
    const convertedBlocks = article.bodyBlocks.map((block) => {
      const converted = convertLegacyLoreLinks(block.content, sourceArticles);
      mergeLinkReport(linkReport, article.id, converted.report);
      return { ...block, content: converted.content };
    });
    const convertedInfobox = article.infobox.map((row) => {
      const converted = convertLegacyLoreLinks(row.value, sourceArticles);
      mergeLinkReport(linkReport, article.id, converted.report);
      return { ...row, value: converted.content };
    });
    const groupPath = String(article.legacyGroup || "General").trim() || "General";
    const groupId = groupIdByPath.get(groupPathKey(article.category, groupPath)) || null;
    const normalized = normalizeLoreArticle({
      ...article,
      campaignId,
      groupId,
      bodyBlocks: convertedBlocks,
      infobox: convertedInfobox,
      publication: {
        status: "published",
        version: 1,
        attentionVersion: 0,
        audience: { mode: "party", actorIds: [] },
        publishedAt: now,
        publishedBy: actor,
      },
      createdAt: article.createdAt || now,
      createdBy: article.createdBy || actor,
      updatedAt: now,
      updatedBy: actor,
    });
    normalized.publishedSnapshot = {
      title: normalized.title,
      category: normalized.category,
      groupId: normalized.groupId,
      tags: normalized.tags,
      image: normalized.image,
      bodyBlocks: normalized.bodyBlocks,
      infobox: normalized.infobox,
      categoryData: normalized.categoryData,
      links: normalized.links,
    };
    return normalized;
  });

  const deliveries = articles.flatMap((article) => activePcActorIds.map((actorId) => ({
    id: createLoreDeliveryId(article.id, actorId),
    campaignId,
    articleId: article.id,
    actorId,
    version: 1,
    attentionVersion: 0,
    readVersion: 0,
    notifiedVersion: 0,
    snapshot: materializeLoreSnapshot(article, actorId),
    publishedAt: now,
    revokedAt: null,
  })));

  return {
    campaignId,
    articles,
    groups: groups.map(({ legacyPathKey, ...group }) => group),
    deliveries,
    backup: {
      campaignId,
      createdAt: now,
      source: "top-level-loreArticles",
      articles: legacyArticles,
    },
    report: {
      campaignId,
      generatedAt: now,
      counts: {
        sourceArticles: legacyArticles.length,
        articles: articles.length,
        groups: groups.length,
        deliveries: deliveries.length,
        convertedLinks: linkReport.converted.length,
        ambiguousLinks: linkReport.ambiguous.length,
        brokenLinks: linkReport.broken.length,
      },
      links: linkReport,
      notificationPolicy: "version-1-without-attention",
      topLevelSourceRetained: true,
    },
  };
}

export function buildMigratedLoreGroups(articles, campaignId, now, actor) {
  const groups = new Map();
  for (const article of articles) {
    const parts = String(article.legacyGroup || "General")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    let parentId = null;
    parts.forEach((name, index) => {
      const path = parts.slice(0, index + 1).join("/");
      const legacyPathKey = groupPathKey(article.category, path);
      if (!groups.has(legacyPathKey)) {
        groups.set(legacyPathKey, {
          id: `lore-group-${article.category}-${slugify(path)}`,
          campaignId,
          category: article.category,
          name,
          parentId,
          sortOrder: groups.size,
          createdAt: now,
          createdBy: actor,
          updatedAt: now,
          updatedBy: actor,
          archivedAt: null,
          legacyPathKey,
        });
      }
      parentId = groups.get(legacyPathKey).id;
    });
  }
  return [...groups.values()];
}

function mergeLinkReport(target, articleId, report) {
  for (const key of ["converted", "ambiguous", "broken"]) {
    target[key].push(...(report[key] || []).map((entry) => ({ articleId, ...entry })));
  }
}

function groupPathKey(category, path) {
  return `${category}:${String(path || "General").trim().toLowerCase()}`;
}

function slugify(value) {
  return String(value || "group")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "group";
}

function deterministicIdFactory(seed) {
  let counter = 0;
  return (prefix) => `${prefix}-${slugify(seed)}-${counter++}`;
}
