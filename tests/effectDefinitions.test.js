import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceEffectDuration,
  applyEffectOnApplyActions,
  materializeEffectDefinition,
  validateEffectDefinition,
} from "../src/shared/rules/effectDefinitions.js";
import { buildDerivedSourceEffects } from "../src/shared/rules/derivedSourceEffects.js";
import {
  createQuicksilverDefinition,
  createScalySkinDefinition,
} from "../src/shared/rules/declarativeRuleSeeds.js";
import { resolveEffectModifiers } from "../src/shared/rules/effectResolver.js";

test("effect definition validation rejects unsupported selectors and passive triggers", () => {
  const result = validateEffectDefinition({
    id: "unsafe",
    label: "Unsafe",
    activation: { mode: "passive", trigger: "cast" },
    modifiers: [{ selector: "actor.any.path", mode: "bonus", value: 1 }],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Passive effects/);
  assert.match(result.errors.join(" "), /unsupported selector/);
});

test("tiered source and actor scaling materialize to numeric modifiers", () => {
  const quicksilver = materializeEffectDefinition(createQuicksilverDefinition(), {
    actor: { id: "actor", kind: "pc", level: 6, inventory: [] },
    targetActorId: "actor",
    sourceActorId: "actor",
    sourceType: "item",
    source: { id: "quick", name: "Quicksilver Mutagen (Moderate)", level: 3 },
  });
  assert.equal(quicksilver.modifiers.find(item => item.selector === "save.reflex").value, 2);
  assert.equal(quicksilver.modifiers.find(item => item.selector === "hp.max").value, -12);
  const applied = applyEffectOnApplyActions({ id: "actor", level: 6, stats: { hp: { current: 40, max: 40, temp: 0 } } }, quicksilver);
  assert.equal(applied.actor.stats.hp.current, 28);
});

test("passive Scaly Skin is derived while unarmored and disappears with armor", () => {
  const baseActor = {
    id: "pc",
    kind: "pc",
    level: 5,
    feats: [{ id: "scaly", name: "Scaly Skin", rules: { effectDefinitions: [createScalySkinDefinition()] } }],
    inventory: [],
  };
  const effects = buildDerivedSourceEffects({ actor: baseActor, campaign: { id: "camp" } });
  assert.equal(effects.length, 1);
  assert.equal(resolveEffectModifiers(effects, "ac").total, 2);
  assert.equal(resolveEffectModifiers(effects, "ac.dex_cap").cap, 3);

  const armored = {
    ...baseActor,
    inventory: [{ id: "armor", name: "Chain Mail", type: "armor", equipped: true }],
  };
  assert.equal(buildDerivedSourceEffects({ actor: armored, campaign: { id: "camp" } }).length, 0);
});

test("round duration advances idempotently and expires", () => {
  const effect = {
    id: "effect",
    duration: { unit: "rounds", remainingRounds: 2, tick: "turn_end" },
    application: { lastTickKey: null },
  };
  const first = advanceEffectDuration(effect, { tick: "turn_end", tickKey: "round-1:actor" });
  assert.equal(first.effect.duration.remainingRounds, 1);
  const duplicate = advanceEffectDuration(first.effect, { tick: "turn_end", tickKey: "round-1:actor" });
  assert.equal(duplicate.changed, false);
  const second = advanceEffectDuration(first.effect, { tick: "turn_end", tickKey: "round-2:actor" });
  assert.equal(second.expired, true);
});
