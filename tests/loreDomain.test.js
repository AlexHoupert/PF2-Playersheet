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
  normalizeLoreArticle,
  publishLoreArticle,
  resolveLoreAudienceActorIds,
} from "../src/shared/lore/loreModel.js";
import {
  buildLoreGroupTree,
  searchLoreDeliveries,
  selectLoreAttention,
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
