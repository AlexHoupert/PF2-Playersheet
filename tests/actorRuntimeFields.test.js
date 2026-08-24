import assert from "node:assert/strict";
import test from "node:test";

import {
  actorToCharacterRuntimeView,
  canonicalizeActorRuntimeFields,
  findActorRuntimeMirrorConflicts,
  runtimeValuesEqual,
} from "../src/shared/actors/actorRuntimeFields.js";
import { createActionContext } from "../src/shared/db/domain/actionContext.js";
import { createActorRecord } from "../src/shared/db/domain/actorReducers.js";
import { actorToCharacterView } from "../src/shared/db/selectors/characterSelectors.js";
import { buildActorRuntimeBackfillPlan } from "../src/shared/maintenance/actorRuntimeBackfill.js";

test("top-level actor runtime fields are canonical when legacy mirrors disagree", () => {
  const actor = {
    id: "actor-1",
    kind: "pc",
    name: "Hero",
    magic: { list: [{ name: "Top-level Spell" }], slots: {} },
    sheet: {
      magic: { list: [{ name: "Stale Sheet Spell" }], slots: {} },
      feats: [{ name: "Legacy Feat" }],
      ancestry: "Human",
    },
  };

  assert.deepEqual(findActorRuntimeMirrorConflicts(actor), ["magic"]);
  assert.equal(actorToCharacterRuntimeView(actor).magic.list[0].name, "Top-level Spell");
  assert.equal(actorToCharacterView(actor).magic.list[0].name, "Top-level Spell");
  assert.equal(actorToCharacterView(actor).feats[0].name, "Legacy Feat");
});

test("legacy sheet-only runtime fields are promoted and removed from sheet", () => {
  const actor = createActorRecord({
    id: "actor-legacy",
    kind: "pc",
    name: "Legacy Hero",
    sheet: {
      magic: { list: [{ name: "Guidance" }], slots: { level1: 1 } },
      feats: [{ name: "Fleet" }],
      actions: [{ name: "Demoralize" }],
      impulses: [{ name: "Elemental Blast" }],
      class: "Kineticist",
    },
  });

  assert.equal(actor.magic.list[0].name, "Guidance");
  assert.equal(actor.feats[0].name, "Fleet");
  assert.equal(actor.actions[0].name, "Demoralize");
  assert.equal(actor.impulses[0].name, "Elemental Blast");
  assert.equal(actor.sheet.class, "Kineticist");
  assert.equal(actor.sheet.magic, undefined);
  assert.equal(actor.sheet.feats, undefined);
  assert.equal(actor.sheet.id, undefined);
});

test("character updates promote legacy sheet data without recreating mirrors", async () => {
  const legacyActor = {
    id: "actor-legacy",
    kind: "pc",
    campaignId: "campaign-1",
    name: "Legacy Hero",
    sheet: {
      magic: { list: [{ name: "Guidance" }], slots: {} },
      feats: [{ name: "Fleet" }],
      gold: 2,
      class: "Bard",
    },
  };
  let writtenActor = null;
  const context = createActionContext({
    mode: "firestore-v2",
    firestore: { app: { options: { projectId: "test" } } },
    repositories: {
      actorRepo: {
        async updateActor(_firestore, _campaignId, _actorId, updater) {
          writtenActor = updater(legacyActor);
        },
      },
    },
  });

  await context.updateCharacter("campaign-1", "actor-legacy", (character) => {
    character.gold = 5;
  });

  assert.equal(writtenActor.gold, 5);
  assert.equal(writtenActor.magic.list[0].name, "Guidance");
  assert.equal(writtenActor.feats[0].name, "Fleet");
  assert.equal(writtenActor.sheet.class, "Bard");
  assert.equal(writtenActor.sheet.magic, undefined);
  assert.equal(writtenActor.sheet.gold, undefined);
});

test("backfill restores a known spell snapshot before removing runtime mirrors", () => {
  const actor = {
    id: "nimwe",
    campaignId: "campaign-1",
    kind: "pc",
    name: "Nimwe",
    magic: { list: Array.from({ length: 17 }, () => ({ name: "Glamorize" })), slots: {} },
    sheet: {
      magic: { list: [{ name: "Visible but incomplete repair" }], slots: {} },
      class: "Bard",
    },
  };
  const restored = [{ name: "Scatter Scree" }, { name: "Glamorize" }, { name: "Marvelous Mount" }];
  const plan = buildActorRuntimeBackfillPlan(
    [{ campaignId: "campaign-1", actorId: "nimwe", actor }],
    { recoveryByActorId: { nimwe: { spellList: restored } } }
  );

  assert.equal(plan.counts.writes, 1);
  assert.equal(plan.counts.recovered, 1);
  assert.deepEqual(plan.writes[0].after.magic.list, restored);
  assert.equal(plan.writes[0].after.sheet.magic, undefined);
  assert.equal(plan.writes[0].after.sheet.class, "Bard");
});

test("canonicalization is idempotent", () => {
  const actor = createActorRecord({
    id: "actor-1",
    kind: "pc",
    name: "Hero",
    magic: { list: [{ name: "Guidance" }], slots: {} },
    sheet: { class: "Cleric" },
  });
  assert.deepEqual(canonicalizeActorRuntimeFields(actor), actor);
});

test("mirror comparisons ignore object property order but preserve array order", () => {
  assert.equal(runtimeValuesEqual({ a: 1, nested: { b: 2, c: 3 } }, { nested: { c: 3, b: 2 }, a: 1 }), true);
  assert.equal(runtimeValuesEqual([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]), false);
});
