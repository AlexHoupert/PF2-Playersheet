import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessAdminTab,
  canMutateCampaignCatalogEntry,
  normalizeCampaignRole,
  selectCampaignCapabilities,
} from "../src/shared/auth/campaignCapabilities.js";

test("campaign roles normalize unknown values to player", () => {
  assert.equal(normalizeCampaignRole("assistant_gm"), "assistant_gm");
  assert.equal(normalizeCampaignRole("owner"), "player");
});

test("assistant gm receives only the selected resource admin tabs", () => {
  const capabilities = selectCampaignCapabilities("assistant_gm");
  assert.equal(capabilities.canAccessAdmin, true);
  assert.equal(capabilities.canManageCampaign, false);
  assert.equal(canAccessAdminTab(capabilities, "items"), true);
  assert.equal(canAccessAdminTab(capabilities, "campaign_changes"), true);
  assert.equal(canAccessAdminTab(capabilities, "players"), false);
  assert.equal(capabilities.canDecideEffectRequests, false);
});

test("spectator is read only but can switch actors and inspect the party", () => {
  const capabilities = selectCampaignCapabilities("spectator");
  assert.equal(capabilities.isReadOnly, true);
  assert.equal(capabilities.canEditOwnActor, false);
  assert.equal(capabilities.canSwitchActors, true);
  assert.equal(capabilities.canViewFullyRevealedParty, true);
});

test("trusted player can only mutate their own custom campaign entry", () => {
  const capabilities = selectCampaignCapabilities("trusted_player");
  assert.equal(canMutateCampaignCatalogEntry(capabilities, {
    mode: "custom",
    ownerEmail: "player@example.test",
  }, "PLAYER@example.test"), true);
  assert.equal(canMutateCampaignCatalogEntry(capabilities, {
    mode: "override",
    ownerEmail: "player@example.test",
  }, "player@example.test"), false);
  assert.equal(canMutateCampaignCatalogEntry(capabilities, {
    mode: "custom",
    ownerEmail: "other@example.test",
  }, "player@example.test"), false);
});
