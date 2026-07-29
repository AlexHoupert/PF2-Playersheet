import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceEffectDuration,
  applyEffectOnApplyActions,
  materializeEffectDefinition,
  resolveActorProficiencyRank,
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

test("proficiency tiers scale modifiers from skill, armor, and weapon ranks", () => {
  const actor = {
    id: "performer",
    skills: { Performance: 6 },
    stats: { proficiencies: { light: 4 } },
    proficiencies: { Firearms: 8 },
  };
  const effect = materializeEffectDefinition({
    id: "virtuosic_performer",
    label: "Virtuosic Performer",
    activation: { mode: "passive", trigger: "owned" },
    modifiers: [
      {
        id: "performance_bonus",
        selector: "skill.performance",
        mode: "bonus",
        bonusType: "circumstance",
        value: {
          mode: "proficiency_tiers",
          value: 1,
          proficiency: { domain: "skill", key: "performance" },
          tiers: [{ min: 6, value: 2 }],
        },
      },
      {
        id: "armor_bonus",
        selector: "ac",
        mode: "bonus",
        bonusType: "item",
        value: {
          mode: "proficiency_tiers",
          value: 1,
          proficiency: { domain: "armor", key: "light" },
          tiers: [{ min: 6, value: 2 }],
        },
      },
      {
        id: "weapon_bonus",
        selector: "attack.ranged",
        mode: "bonus",
        bonusType: "item",
        value: {
          mode: "proficiency_tiers",
          value: 1,
          proficiency: { domain: "weapon", key: "firearms" },
          tiers: [{ min: 6, value: 2 }, { min: 8, value: 3 }],
        },
      },
    ],
  }, {
    actor,
    targetActorId: actor.id,
    sourceType: "feat",
    source: { id: "virtuosic", name: "Virtuosic Performer" },
  });

  assert.deepEqual(effect.modifiers.map(modifier => modifier.value), [2, 1, 3]);
  assert.equal(resolveActorProficiencyRank({ skills: { Perform: 6 } }, { domain: "skill", key: "performance" }), 6);
});

test("proficiency scaling validates its target and tiers", () => {
  const missingTarget = validateEffectDefinition({
    id: "missing_target",
    label: "Missing target",
    activation: { mode: "passive", trigger: "owned" },
    modifiers: [{
      selector: "ac",
      mode: "bonus",
      bonusType: "status",
      value: { mode: "proficiency_tiers", value: 1, proficiency: { domain: "skill", key: "" }, tiers: [{ min: 6, value: 2 }] },
    }],
  });
  assert.equal(missingTarget.valid, false);
  assert.match(missingTarget.errors.join(" "), /requires a proficiency/);

  const invalidDomain = validateEffectDefinition({
    id: "invalid_domain",
    label: "Invalid domain",
    activation: { mode: "passive", trigger: "owned" },
    modifiers: [{
      selector: "ac",
      mode: "bonus",
      bonusType: "status",
      value: { mode: "proficiency_tiers", value: 1, proficiency: { domain: "arbitrary", key: "ac" }, tiers: [{ min: 6, value: 2 }] },
    }],
  });
  assert.equal(invalidDomain.valid, false);
  assert.match(invalidDomain.errors.join(" "), /unsupported proficiency type/);
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
