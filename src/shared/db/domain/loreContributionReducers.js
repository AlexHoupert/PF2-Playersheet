import { createLoreArticleDraft, normalizeLoreCategory } from "../../lore/loreModel.js";

export function normalizeLoreContribution(input = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const createId = options.createId || (() => `lore_contribution_${crypto.randomUUID()}`);
  const id = String(input.id || createId("lore_contribution"));
  const status = ["active", "archived", "promoted"].includes(input.status)
    ? input.status
    : "active";
  return stripUndefined({
    ...input,
    id,
    campaignId: String(input.campaignId || options.campaignId || ""),
    title: String(input.title || "Untitled contribution").trim() || "Untitled contribution",
    category: normalizeLoreCategory(input.category),
    content: String(input.content || ""),
    tags: normalizeStringList(input.tags),
    status,
    isPlayerContribution: true,
    createdBy: input.createdBy || options.actorEmail || null,
    createdByActorId: input.createdByActorId || options.actorId || null,
    authoredRole: input.authoredRole || options.role || "trusted_player",
    createdAt: input.createdAt || now,
    updatedAt: now,
    updatedBy: options.actorEmail || input.updatedBy || input.createdBy || null,
    archivedAt: status === "archived" ? input.archivedAt || now : input.archivedAt || null,
    archivedBy: input.archivedBy || null,
    promotedAt: status === "promoted" ? input.promotedAt || now : input.promotedAt || null,
    promotedBy: input.promotedBy || null,
    officialArticleId: input.officialArticleId || null,
  });
}

export function archiveLoreContribution(contribution, options = {}) {
  const now = options.now || new Date().toISOString();
  return normalizeLoreContribution({
    ...contribution,
    status: "archived",
    archivedAt: now,
    archivedBy: options.actorEmail || null,
  }, { ...options, now });
}

export function promoteLoreContribution(contribution, options = {}) {
  const now = options.now || new Date().toISOString();
  const article = createLoreArticleDraft({
    id: options.articleId,
    title: contribution.title,
    category: contribution.category,
    tags: contribution.tags || [],
    content: contribution.content,
    bodyBlocks: [{
      id: `${options.articleId}-content`,
      type: "content",
      content: contribution.content,
    }],
    sourceContributionId: contribution.id,
  }, {
    actor: options.actorEmail || null,
    createId: () => options.articleId,
    now,
  });
  const nextContribution = normalizeLoreContribution({
    ...contribution,
    status: "promoted",
    promotedAt: now,
    promotedBy: options.actorEmail || null,
    officialArticleId: article.id,
  }, { ...options, now });
  return { article, contribution: nextContribution };
}

function normalizeStringList(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((entry) => String(entry || "").trim()).filter(Boolean))];
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
