import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentTurnCombatantId,
  getCurrentTurnIndex,
  getNextTurnCombatantId,
  getRotatedEncounterTurnOrder,
} from '../src/shared/encounter/turnOrder.js';

test('turn order normalizes a legacy currentTurnIndex to a stable combatant id', () => {
  const encounter = {
    currentTurnIndex: 1,
    combatants: [
      { id: 'slow', initiative: 5 },
      { id: 'fast', initiative: 20 },
      { id: 'middle', initiative: 10 },
    ],
  };

  assert.equal(getCurrentTurnCombatantId(encounter), 'middle');
  assert.equal(getCurrentTurnIndex(encounter), 1);
  assert.deepEqual(getRotatedEncounterTurnOrder(encounter).map((combatant) => combatant.id), ['middle', 'slow', 'fast']);
});

test('turn order skips defeated combatants and handles an all-defeated encounter', () => {
  const encounter = {
    currentTurnCombatantId: 'fast',
    combatants: [
      { id: 'slow', initiative: 5 },
      { id: 'fast', initiative: 20 },
      { id: 'middle', initiative: 10, defeatedAt: '2026-07-10T12:00:00.000Z' },
    ],
  };

  assert.equal(getNextTurnCombatantId(encounter), 'slow');
  assert.deepEqual(getRotatedEncounterTurnOrder(encounter, { includeDefeated: false }).map((combatant) => combatant.id), ['fast', 'slow']);
  assert.equal(getNextTurnCombatantId({
    currentTurnCombatantId: 'fast',
    combatants: encounter.combatants.map((combatant) => ({ ...combatant, defeatedAt: '2026-07-10T12:00:00.000Z' })),
  }), null);
});
