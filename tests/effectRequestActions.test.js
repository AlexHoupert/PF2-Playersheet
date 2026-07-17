import assert from "node:assert/strict";
import test from "node:test";
import { createDataActions } from "../src/shared/db/domain/createDataActions.js";
import { createQuicksilverDefinition } from "../src/shared/rules/declarativeRuleSeeds.js";

function createActions(role, repositories, db = { campaigns: { campaign: { id: "campaign", actorEffects: [] } } }) {
  return createDataActions({
    actorEmail: role === "gm" ? "gm@example.test" : "player@example.test",
    campaignId: "campaign",
    db,
    firestore: { app: { options: { projectId: "test" } } },
    memberRole: role,
    mode: "firestore-v2",
    repositories,
    createId: prefix => `${prefix}_id`,
  });
}

test("creature source effect request is targeted and does not consume on create", async () => {
  const calls = [];
  const actions = createActions("player", {
    effectRequestRepo: {
      async createRequest(_firestore, campaignId, request) { calls.push({ campaignId, request }); },
    },
  });
  const source = { instanceId: "mutagen", name: "Quicksilver Mutagen (Lesser)", qty: 1, level: 1 };
  await actions.effect.createEffectRequest("campaign", "pc", [{
    targetActorId: "encounter:one:combatant:goblin",
    targetType: "combatant",
    actorKind: "npc",
    name: "Goblin",
  }], source, createQuicksilverDefinition());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.requestedBy, "player@example.test");
  assert.equal(calls[0].request.status, "pending");
  assert.equal(source.qty, 1);
});

test("gm approval consumes the source once and materializes the requested effect", async () => {
  const definition = createQuicksilverDefinition();
  const request = {
    id: "request",
    status: "pending",
    campaignId: "campaign",
    sourceActorId: "pc",
    source: { instanceId: "mutagen", name: "Quicksilver Mutagen (Lesser)", qty: 1, level: 1 },
    definitionSnapshot: definition,
    targets: [{ targetActorId: "npc", actorKind: "npc", name: "Goblin" }],
    createdBy: "player@example.test",
  };
  const sourceActor = { id: "pc", kind: "pc", level: 4, inventory: [{ ...request.source }] };
  const calls = [];
  const actions = createActions("gm", {
    effectRequestRepo: {
      async approveRequest(_firestore, campaignId, requestId, resolver) {
        calls.push({ campaignId, requestId, result: resolver(request, sourceActor) });
      },
    },
  });
  await actions.effect.approveEffectRequest("campaign", "request");
  assert.equal(calls[0].result.sourceActor.inventory.length, 0);
  assert.equal(calls[0].result.effects.length, 1);
  assert.equal(calls[0].result.effects[0].targetActorId, "npc");
});

test("assistant gm can inspect but cannot decide requests", async () => {
  const actions = createActions("assistant_gm", {});
  await assert.rejects(() => actions.effect.approveEffectRequest("campaign", "request"), /Only a campaign GM/);
  await assert.rejects(() => actions.effect.rejectEffectRequest("campaign", "request"), /Only a campaign GM/);
});
