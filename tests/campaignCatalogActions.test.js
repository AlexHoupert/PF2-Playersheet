import assert from "node:assert/strict";
import test from "node:test";

import { createDataActions } from "../src/shared/db/domain/createDataActions.js";

function createHarness(role = "gm") {
  const calls = [];
  const repositories = {
    campaignCatalogRepo: {
      async saveEntryWithEvent(_firestore, campaignId, entry, event) {
        calls.push({ type: "save", campaignId, entry, event });
      },
      async deleteEntryWithEvent(_firestore, campaignId, entryId, event) {
        calls.push({ type: "delete", campaignId, entryId, event });
      },
      async revertEvent(_firestore, campaignId, eventId, event) {
        calls.push({ type: "revert", campaignId, eventId, event });
      },
      async promoteEntryWithEvent(_firestore, campaignId, entry, event) {
        calls.push({ type: "promote", campaignId, entry, event });
      },
    },
    catalogOverrideRepo: {
      async setCatalogOverride(_firestore, entry) { calls.push({ type: "promote", entry }); },
    },
  };
  const db = {
    users: { "user@example.test": { role, campaignId: "campaign" } },
    campaigns: { campaign: { id: "campaign", catalogEntries: {} } },
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

test("campaign GM catalog save records a targeted audited entry", async () => {
  const { actions, calls } = createHarness("gm");
  await actions.catalog.saveCatalogEntry({
    id: "spell_bless",
    catalogType: "spell",
    baseId: "bless.json",
    mode: "override",
    payload: { name: "Bless", rank: 1 },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].campaignId, "campaign");
  assert.equal(calls[0].entry.mode, "override");
  assert.equal(calls[0].event.operation, "override");
});

test("trusted player can create a fork but cannot save an override", async () => {
  const { actions, calls } = createHarness("trusted_player");
  await actions.catalog.saveCatalogEntry({
    id: "fork",
    catalogType: "item",
    baseId: "base-item.json",
    mode: "custom",
    payload: { name: "My Item" },
  });
  assert.equal(calls[0].entry.ownerEmail, "user@example.test");
  assert.equal(calls[0].entry.origin, "fork");
  await assert.rejects(() => actions.catalog.saveCatalogEntry({
    catalogType: "item",
    baseId: "base-item.json",
    mode: "override",
    payload: { name: "Changed" },
  }), /must fork/);
});

test("spectator cannot author campaign catalog content", async () => {
  const { actions } = createHarness("spectator");
  await assert.rejects(() => actions.catalog.saveCatalogEntry({
    catalogType: "item",
    mode: "custom",
    payload: { name: "Nope" },
  }), /cannot author/);
});

test("global admin promotion creates an audited campaign event", async () => {
  const { actions, calls } = createHarness("admin");
  await actions.catalog.promoteToGlobalCatalog({
    id: "campaign_spell",
    campaignId: "campaign",
    catalogType: "spell",
    mode: "custom",
    payload: { name: "Campaign Spell" },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "promote");
  assert.equal(calls[0].event.operation, "promote");
  assert.equal(calls[0].entry.updatedBy, "user@example.test");
});
