import assert from "node:assert/strict";
import test from "node:test";
import { createDataActions } from "../src/shared/db/domain/createDataActions.js";
import { normalizeLoreContribution, promoteLoreContribution } from "../src/shared/db/domain/loreContributionReducers.js";

function createHarness(role, contribution = null) {
  const calls = [];
  const repositories = {
    loreContributionRepo: {
      async setContribution(_firestore, campaignId, value) { calls.push({ type: "save", campaignId, value }); },
      async promoteContribution(_firestore, campaignId, value, article) { calls.push({ type: "promote", campaignId, value, article }); },
    },
  };
  const db = {
    campaigns: {
      campaign: {
        id: "campaign",
        loreContributions: contribution ? [contribution] : [],
        members: [{ email: "user@example.test", assignedActorId: "actor" }],
      },
    },
  };
  const actions = createDataActions({
    actorEmail: "user@example.test",
    campaignId: "campaign",
    db,
    firestore: { app: { options: { projectId: "test" } } },
    memberRole: role,
    mode: "firestore-v2",
    repositories,
    createId: prefix => `${prefix}_id`,
  });
  return { actions, calls };
}

test("trusted player creates a party-visible owned lore contribution", async () => {
  const { actions, calls } = createHarness("trusted_player");
  const id = await actions.loreContribution.saveContribution("campaign", {
    title: "A player theory",
    category: "history",
    content: "The mural is probably a map.",
  });
  assert.equal(id, "lore_contribution_id");
  assert.equal(calls[0].value.createdBy, "user@example.test");
  assert.equal(calls[0].value.createdByActorId, "actor");
  assert.equal(calls[0].value.status, "active");
  assert.equal(calls[0].value.isPlayerContribution, true);
});

test("spectator cannot create lore contributions", async () => {
  const { actions } = createHarness("spectator");
  await assert.rejects(
    () => actions.loreContribution.saveContribution("campaign", { title: "No", content: "No" }),
    /cannot create lore contributions/
  );
});

test("gm promotion creates an official draft and closes the contribution atomically", async () => {
  const contribution = normalizeLoreContribution({
    id: "contribution",
    campaignId: "campaign",
    title: "Recovered inscription",
    category: "locations",
    content: "The lower gate opens at dusk.",
    createdBy: "player@example.test",
    createdByActorId: "actor",
  }, { now: "2026-01-01T00:00:00.000Z" });
  const { actions, calls } = createHarness("gm", contribution);
  const articleId = await actions.loreContribution.promoteContributionToOfficial("campaign", contribution.id);
  assert.equal(articleId, "lore_id");
  assert.equal(calls[0].type, "promote");
  assert.equal(calls[0].value.status, "promoted");
  assert.equal(calls[0].article.sourceContributionId, contribution.id);
  assert.equal(calls[0].article.publication.status, "draft");
});

test("pure promotion preserves the contribution source on the official draft", () => {
  const result = promoteLoreContribution({ id: "c", title: "Theory", category: "other", content: "Text" }, {
    actorEmail: "gm@example.test",
    articleId: "article",
    now: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(result.article.id, "article");
  assert.equal(result.article.sourceContributionId, "c");
  assert.equal(result.contribution.officialArticleId, "article");
});
