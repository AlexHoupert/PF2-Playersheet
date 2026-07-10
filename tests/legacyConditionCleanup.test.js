import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLegacyConditionCleanupPlan,
  isLegacyGenericConditionEffect,
} from '../src/shared/maintenance/legacyConditionCleanup.js';

test('legacy generic condition cleanup only targets Persistent Damage and Fast Healing condition records', () => {
  assert.equal(isLegacyGenericConditionEffect({ category: 'condition', label: 'Persistent Damage' }), true);
  assert.equal(isLegacyGenericConditionEffect({ category: 'condition', name: 'fast healing' }), true);
  assert.equal(isLegacyGenericConditionEffect({ category: 'damage_effect', label: '1d6 fire persistent' }), false);
  assert.equal(isLegacyGenericConditionEffect({ category: 'condition', label: 'Frightened' }), false);
});

test('legacy generic condition cleanup produces an idempotent campaign update plan and preserves unrelated conditions', () => {
  const input = {
    campaignId: 'campaign-1',
    effects: [
      { id: 'persistent', category: 'condition', label: 'Persistent Damage' },
      { id: 'frightened', category: 'condition', label: 'Frightened' },
    ],
    encounters: [{
      id: 'encounter-1',
      combatants: [
        { id: 'goblin', conditions: ['Persistent Damage', 'Frightened'] },
        { id: 'hero', conditions: ['Fast Healing'] },
      ],
    }],
  };
  const plan = buildLegacyConditionCleanupPlan(input);

  assert.deepEqual(plan.effectIds, ['persistent']);
  assert.equal(plan.counts.combatants, 2);
  assert.deepEqual(plan.encounterUpdates[0].cleanedCombatants[0].conditions, ['Frightened']);
  assert.deepEqual(plan.encounterUpdates[0].cleanedCombatants[1].conditions, []);
  assert.deepEqual(buildLegacyConditionCleanupPlan({
    campaignId: input.campaignId,
    effects: input.effects.filter((effect) => effect.id !== 'persistent'),
    encounters: [{ ...input.encounters[0], combatants: plan.encounterUpdates[0].cleanedCombatants }],
  }).counts, { actorEffects: 0, encounters: 0, combatants: 0 });
});
