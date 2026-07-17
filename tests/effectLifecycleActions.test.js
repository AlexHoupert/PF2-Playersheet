import assert from "node:assert/strict";
import test from "node:test";

import { createDataActions } from "../src/shared/db/domain/createDataActions.js";
import { createQuicksilverDefinition } from "../src/shared/rules/declarativeRuleSeeds.js";

function createHarness(campaign) {
  let state = { campaigns: { campaign } };
  const actions = createDataActions({
    actorEmail: "player@example.test",
    campaignId: "campaign",
    db: state,
    memberRole: "player",
    mode: "legacy",
    setDb(updater) {
      state = typeof updater === "function" ? updater(state) : updater;
    },
    createId: prefix => `${prefix}_test`,
  });
  return { actions, get state() { return state; } };
}

test("consumable source activation consumes the item and creates its actor effect", async () => {
  const item = {
    instanceId: "quicksilver-1",
    id: "quicksilver",
    name: "Quicksilver Mutagen (Moderate)",
    level: 3,
    qty: 1,
  };
  const harness = createHarness({
    id: "campaign",
    actors: [{
      id: "hero",
      kind: "pc",
      level: 6,
      name: "Hero",
      inventory: [item],
      stats: { hp: { current: 40, max: 40, temp: 0 } },
    }],
    actorEffects: [],
  });

  await harness.actions.effect.applySourceEffect(
    "campaign",
    "hero",
    ["hero"],
    item,
    createQuicksilverDefinition(),
    { sourceType: "item" }
  );

  const campaign = harness.state.campaigns.campaign;
  assert.equal(campaign.actors[0].inventory.length, 0);
  assert.equal(campaign.actors[0].stats.hp.current, 28);
  assert.equal(campaign.actorEffects.length, 1);
  assert.equal(campaign.actorEffects[0].duration.unit, "daily_preparation");
  assert.equal(campaign.actorEffects[0].modifiers.find(entry => entry.selector === "hp.max").value, -12);
});

test("daily preparation updates the actor and removes only matching daily effects", async () => {
  const harness = createHarness({
    id: "campaign",
    actors: [{ id: "hero", kind: "pc", name: "Hero", prepared: false }],
    actorEffects: [
      { id: "daily", targetActorId: "hero", duration: { unit: "daily_preparation" } },
      { id: "manual", targetActorId: "hero", duration: { unit: "manual" } },
      { id: "other", targetActorId: "other", duration: { unit: "daily_preparation" } },
    ],
  });

  await harness.actions.effect.performDailyPreparation("campaign", "hero", actor => ({
    ...actor,
    prepared: true,
  }));

  const campaign = harness.state.campaigns.campaign;
  assert.equal(campaign.actors[0].prepared, true);
  assert.deepEqual(campaign.actorEffects.map(effect => effect.id), ["manual", "other"]);
});
