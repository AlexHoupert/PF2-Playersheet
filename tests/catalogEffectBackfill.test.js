import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogEffectBackfillPlan } from "../src/shared/maintenance/catalogEffectBackfill.js";

const indexes = {
  item: [{ name: "Quicksilver Mutagen (Lesser)", sourceFile: "items/quicksilver-lesser.json", level: 1 }],
  feat: [{ name: "Scaly Skin", sourceFile: "feats/scaly-skin.json", level: 1 }],
  spell: [{ name: "Bless", sourceFile: "spells/bless.json", level: 1 }],
  impulse: [{ name: "Metal Carapace", sourceFile: "impulses/metal-carapace.json", level: 1 }],
};

test("catalog effect backfill creates declarative overrides for seeded sources", () => {
  const plan = buildCatalogEffectBackfillPlan({ catalogIndexes: indexes });
  assert.equal(plan.counts.writes, 4);
  assert.equal(plan.counts.creates, 4);
  assert.deepEqual(new Set(plan.writes.map(entry => entry.catalogType)), new Set(["item", "feat", "spell", "impulse"]));
  assert.ok(plan.writes.every(entry => entry.override.payload.rules.effectDefinitions.length > 0));
});

test("catalog effect backfill preserves manual definitions and updates empty overrides", () => {
  const existingOverrides = [
    {
      id: "spell_bless",
      catalogType: "spell",
      baseId: "spells/bless.json",
      mode: "override",
      payload: { name: "Bless", rules: { effectDefinitions: [{ id: "manual-rule" }] } },
    },
    {
      id: "feat_scaly",
      catalogType: "feat",
      baseId: "feats/scaly-skin.json",
      mode: "override",
      payload: { name: "Scaly Skin", description: "Keep me" },
    },
  ];
  const plan = buildCatalogEffectBackfillPlan({ catalogIndexes: indexes, existingOverrides });
  assert.equal(plan.skipped.some(entry => entry.overrideId === "spell_bless"), true);
  const featWrite = plan.writes.find(entry => entry.catalogType === "feat");
  assert.equal(featWrite.before.id, "feat_scaly");
  assert.equal(featWrite.override.payload.description, "Keep me");
  assert.equal(featWrite.override.payload.rules.effectDefinitions[0].id, "scaly_skin_ac");
});
