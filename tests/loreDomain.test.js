import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBestiaryRevealDeliveries,
  convertLegacyLoreLinks,
  createLoreArticleDraft,
  doesLoreDeliveryNeedPopup,
  isLoreDeliveryUnread,
  markLoreDeliveryNotified,
  markLoreDeliveryRead,
  materializeLoreSnapshot,
  normalizeKnowledgeNote,
  normalizeKnowledgeNoteTargetSnapshot,
  normalizeLoreArticle,
  publishLoreArticle,
  resolveLoreAudienceActorIds,
} from "../src/shared/lore/loreModel.js";
import {
  buildLoreGroupTree,
  buildKnowledgeNoteViewModels,
  filterKnowledgeNoteViewModels,
  searchLoreDeliveries,
  selectLoreAttention,
  selectOwnKnowledgeNote,
  selectPartyKnowledgeNotes,
  validateLoreLinks,
} from "../src/shared/lore/loreSelectors.js";
import { buildLoreMigrationPlan } from "../src/shared/maintenance/loreMigration.js";

const createId = (() => {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
})();

test("legacy lore normalizes without losing markup", () => {
  const article = normalizeLoreArticle({
    id: "old",
    title: "Old entry",
    category: "History",
    group: "Eras/Ancient",
    content: "# Heading\nSee [[Another]].",
    infobox: "Region: Elfharrow\nPopulation: 5",
  }, { createId });

  assert.equal(article.category, "history");
  assert.equal(article.legacyGroup, "Eras/Ancient");
  assert.equal(article.bodyBlocks[0].content, "# Heading\nSee [[Another]].");
  assert.deepEqual(article.infobox.map((row) => row.label), ["Region", "Population"]);
  assert.equal(article.links[0].type, "legacyTitle");
});

test("reveal blocks are materialized per actor without leaking GM content", () => {
  const article = createLoreArticleDraft({
    id: "secret",
    title: "Secret",
    bodyBlocks: [
      { id: "public", type: "content", content: "Known" },
      { id: "party", type: "reveal", content: "Party", audience: { mode: "party" } },
      { id: "one", type: "reveal", content: "Only A", audience: { mode: "actors", actorIds: ["a"] } },
      { id: "gm", type: "reveal", content: "GM only", audience: { mode: "gm" } },
    ],
  }, { createId, now: "2026-01-01", actor: "gm@example.com" });

  assert.deepEqual(materializeLoreSnapshot(article, "a").bodyBlocks.map((block) => block.id), ["public", "party", "one"]);
  assert.deepEqual(materializeLoreSnapshot(article, "b").bodyBlocks.map((block) => block.id), ["public", "party"]);
});

test("publish materializes deliveries and keeps notification attention independent", () => {
  const article = createLoreArticleDraft({ id: "entry", title: "Entry" }, { createId, now: "2026-01-01" });
  const silent = publishLoreArticle({
    article,
    activePcActorIds: ["a", "b"],
    audience: { mode: "party" },
    notify: false,
    now: "2026-01-02",
  });
  assert.equal(silent.article.publication.version, 1);
  assert.equal(silent.article.publication.attentionVersion, 0);
  assert.equal(selectLoreAttention(silent.deliveries).total, 0);

  const notified = publishLoreArticle({
    article: silent.article,
    activePcActorIds: ["a", "b"],
    existingDeliveries: silent.deliveries,
    audience: { mode: "actors", actorIds: ["a"] },
    notify: true,
    now: "2026-01-03",
  });
  assert.equal(notified.article.publication.version, 2);
  assert.equal(notified.article.publication.attentionVersion, 2);
  assert.equal(notified.deliveries.length, 1);
  assert.equal(notified.revokedDeliveries[0].actorId, "b");
  assert.equal(isLoreDeliveryUnread(notified.deliveries[0]), true);
  assert.equal(doesLoreDeliveryNeedPopup(notified.deliveries[0]), true);

  const notifiedAck = markLoreDeliveryNotified(notified.deliveries[0], "2026-01-04");
  assert.equal(doesLoreDeliveryNeedPopup(notifiedAck), false);
  assert.equal(isLoreDeliveryUnread(notifiedAck), true);
  const read = markLoreDeliveryRead(notifiedAck, "2026-01-05");
  assert.equal(isLoreDeliveryUnread(read), false);
});

test("bestiary reveal notifications reuse versioned Knowledge deliveries", () => {
  const first = buildBestiaryRevealDeliveries({
    creatureId: "wolf",
    creatureName: "Winter Wolf",
    activePcActorIds: ["a", "b"],
    now: "2026-01-01",
  });
  const second = buildBestiaryRevealDeliveries({
    creatureId: "wolf",
    creatureName: "Winter Wolf",
    activePcActorIds: ["a", "b"],
    existingDeliveries: first.map((delivery) => markLoreDeliveryRead(delivery, "2026-01-02")),
    now: "2026-01-03",
  });

  assert.equal(first[0].deliveryKind, "bestiaryReveal");
  assert.equal(first[0].snapshot.category, "bestiary");
  assert.equal(second[0].version, 2);
  assert.equal(second[0].attentionVersion, 2);
  assert.equal(second[0].readVersion, 1);
  assert.equal(isLoreDeliveryUnread(second[0]), true);
});

test("selected actor audiences are intersected with active PCs", () => {
  assert.deepEqual(
    resolveLoreAudienceActorIds({ mode: "actors", actorIds: ["a", "archived"] }, ["a", "b"]),
    ["a"]
  );
});

test("knowledge notes keep independent GM and party sharing controls", () => {
  const own = normalizeKnowledgeNote({
    actorId: "a",
    targetType: "loreArticle",
    targetId: "entry",
    content: "Private lead",
    sharedWithGm: true,
    sharedWithParty: false,
  }, { now: "2026-01-01" });
  const party = normalizeKnowledgeNote({
    actorId: "b",
    targetType: "loreArticle",
    targetId: "entry",
    content: "Shared lead",
    sharedWithParty: true,
  }, { now: "2026-01-02" });
  const hidden = normalizeKnowledgeNote({
    actorId: "c",
    targetType: "loreArticle",
    targetId: "entry",
    content: "Private note",
  }, { now: "2026-01-03" });

  assert.equal(own.sharedWithGm, true);
  assert.equal(own.sharedWithParty, false);
  assert.equal(normalizeKnowledgeNote({ ...party, updatedAt: "2025-12-31" }).updatedAt, "2025-12-31");
  assert.equal(selectOwnKnowledgeNote([own, party], "a", "loreArticle", "entry")?.id, own.id);
  assert.deepEqual(selectPartyKnowledgeNotes([own, party, hidden], "a", "loreArticle", "entry").map((note) => note.id), [party.id]);
});

test("knowledge note snapshots preserve safe target metadata", () => {
  assert.deepEqual(normalizeKnowledgeNoteTargetSnapshot({
    title: "Old Chronicle",
    category: "History",
    image: "/chronicle.webp",
  }), {
    title: "Old Chronicle",
    category: "history",
    image: "/chronicle.webp",
  });
  assert.deepEqual(normalizeKnowledgeNoteTargetSnapshot({ title: "Known Beast" }, "creature"), {
    title: "Known Beast",
    category: "bestiary",
    image: null,
  });
  assert.equal(normalizeKnowledgeNoteTargetSnapshot(null), undefined);
});

test("knowledge note overview resolves current targets and retains unavailable notes", () => {
  const viewModels = buildKnowledgeNoteViewModels({
    notes: [
      { id: "lore-note", actorId: "pc", targetType: "loreArticle", targetId: "chronicle", content: "Ask about the eastern road.", sharedWithGm: true, createdAt: "2026-01-01", updatedAt: "2026-01-03", targetSnapshot: { title: "Old title", category: "history" } },
      { id: "creature-note", actorId: "pc", targetType: "creature", targetId: "wolf", content: "It avoids silver bells.", sharedWithParty: true, createdAt: "2026-01-02", updatedAt: "2026-01-04", targetSnapshot: { title: "Old wolf name", category: "bestiary" } },
      { id: "orphan-note", actorId: "pc", targetType: "loreArticle", targetId: "retracted", content: "Do not forget this clue.", sharedWithGm: true, sharedWithParty: true, createdAt: "2026-01-05", updatedAt: "2026-01-05", targetSnapshot: { title: "Retracted Secret", category: "other" } },
    ],
    deliveries: [{ articleId: "chronicle", snapshot: { title: "Current Chronicle", category: "history", groupId: "roads" } }],
    groups: [
      { id: "world", name: "World", category: "history" },
      { id: "roads", name: "Roads", category: "history", parentId: "world" },
    ],
    visibleCreatures: [{ id: "wolf", name: "Winter Wolf" }],
    actors: [{ id: "pc", name: "Nimwe" }],
  });

  assert.equal(viewModels[0].id, "orphan-note");
  assert.equal(viewModels.find((note) => note.id === "lore-note").targetTitle, "Current Chronicle");
  assert.equal(viewModels.find((note) => note.id === "lore-note").groupLabel, "World / Roads");
  assert.deepEqual(viewModels.find((note) => note.id === "creature-note").navigationCommand, { type: "creature", targetId: "wolf" });
  assert.equal(viewModels.find((note) => note.id === "orphan-note").targetTitle, "Retracted Secret");
  assert.equal(viewModels.find((note) => note.id === "orphan-note").targetAccessible, false);
  assert.equal(viewModels.find((note) => note.id === "orphan-note").navigationCommand, null);
});

test("knowledge note overview keeps incomplete legacy note ordering deterministic", () => {
  const input = {
    notes: [
      { id: "undated", actorId: "pc", targetType: "loreArticle", targetId: "missing", content: "Old clue" },
      { id: "dated", actorId: "pc", targetType: "loreArticle", targetId: "current", content: "New clue", updatedAt: "2026-01-01" },
    ],
  };

  const first = buildKnowledgeNoteViewModels(input);
  const second = buildKnowledgeNoteViewModels(input);

  assert.deepEqual(first.map((note) => note.id), ["dated", "undated"]);
  assert.deepEqual(first.map((note) => note.updatedAt), second.map((note) => note.updatedAt));
});

test("knowledge note overview composes search filters sharing and sorting", () => {
  const viewModels = buildKnowledgeNoteViewModels({
    notes: [
      { id: "private", actorId: "pc", targetType: "loreArticle", targetId: "a", content: "Amber clue", updatedAt: "2026-01-02" },
      { id: "party", actorId: "pc", targetType: "creature", targetId: "wolf", content: "Silver clue", sharedWithParty: true, updatedAt: "2026-01-03" },
      { id: "dual", actorId: "pc", targetType: "loreArticle", targetId: "missing", content: "Hidden clue", sharedWithGm: true, sharedWithParty: true, updatedAt: "2026-01-04", targetSnapshot: { title: "Lost Lead", category: "other" } },
    ],
    deliveries: [{ articleId: "a", snapshot: { title: "Amber Archive", category: "history" } }],
    visibleCreatures: [{ id: "wolf", name: "Winter Wolf" }],
  });

  assert.deepEqual(filterKnowledgeNoteViewModels(viewModels, { query: "amber" }).map((note) => note.id), ["private"]);
  assert.deepEqual(filterKnowledgeNoteViewModels(viewModels, { targetType: "creature", sharing: "party" }).map((note) => note.id), ["party"]);
  assert.deepEqual(filterKnowledgeNoteViewModels(viewModels, { availability: "unavailable", sharing: "gm-party" }).map((note) => note.id), ["dual"]);
  assert.deepEqual(filterKnowledgeNoteViewModels(viewModels, { sortBy: "title-asc" }).map((note) => note.id), ["private", "dual", "party"]);
});

test("legacy title links convert only on a unique match", () => {
  const result = convertLegacyLoreLinks(
    "See [[Velran]] and [[Missing|a rumor]].",
    [{ id: "velran", title: "Velran" }]
  );
  assert.equal(result.content, "See [[lore:velran|Velran]] and [[Missing|a rumor]].");
  assert.equal(result.report.converted.length, 1);
  assert.equal(result.report.broken.length, 1);

  const ambiguous = convertLegacyLoreLinks("[[Velran]]", [
    { id: "one", title: "Velran" },
    { id: "two", title: "VELRAN" },
  ]);
  assert.equal(ambiguous.content, "[[Velran]]");
  assert.equal(ambiguous.report.ambiguous.length, 1);
});

test("groups, search, alerts, and link validation share one selector contract", () => {
  const groups = [
    { id: "root", name: "Regional", category: "history", sortOrder: 0 },
    { id: "child", name: "Velran", category: "history", parentId: "root", sortOrder: 0 },
  ];
  assert.equal(buildLoreGroupTree(groups, "history")[0].children[0].id, "child");

  const deliveries = [{
    id: "d1",
    articleId: "a1",
    actorId: "pc",
    attentionVersion: 1,
    readVersion: 0,
    notifiedVersion: 0,
    snapshot: {
      title: "Velran",
      category: "history",
      groupId: "child",
      tags: ["city"],
      bodyBlocks: [{ content: "Merchant republic" }],
      infobox: [],
      links: [{ type: "lore", id: "road", label: "Old trade road" }],
    },
  }];
  assert.equal(searchLoreDeliveries(deliveries, groups, "merchant").length, 1);
  assert.equal(searchLoreDeliveries(deliveries, groups, "regional").length, 1);
  assert.equal(searchLoreDeliveries(deliveries, groups, "trade road").length, 1);
  assert.equal(selectLoreAttention(deliveries).byCategory.history, 1);

  const validation = validateLoreLinks({
    id: "source",
    links: [
      { type: "lore", id: "a1", label: "Entry" },
      { type: "creature", id: "wolf", label: "Wolf" },
      { type: "lore", id: "missing", label: "Missing" },
    ],
  }, ["a1"], ["wolf"]);
  assert.deepEqual(validation.map((link) => link.valid), [true, true, false]);
});

test("migration preserves IDs, builds stable groups, and suppresses historical alerts", () => {
  const plan = buildLoreMigrationPlan({
    campaignId: "campaign",
    legacyArticles: [
      { id: "one", title: "One", category: "history", group: "Eras/Ancient", content: "See [[Two]]." },
      { id: "two", title: "Two", category: "history", group: "Eras", content: "Known." },
    ],
    activePcActorIds: ["pc1"],
    now: "2026-01-01",
  });

  assert.deepEqual(plan.articles.map((article) => article.id), ["one", "two"]);
  assert.equal(plan.groups.length, 2);
  assert.match(plan.articles[0].bodyBlocks[0].content, /\[\[lore:two\|Two\]\]/);
  assert.equal(plan.deliveries.length, 2);
  assert.equal(plan.deliveries[0].attentionVersion, 0);
  assert.equal(plan.report.counts.convertedLinks, 1);
  assert.equal(plan.report.topLevelSourceRetained, true);
});
