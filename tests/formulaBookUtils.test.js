import test from 'node:test';
import assert from 'node:assert/strict';
import {
    filterFormulaItemsByType,
    filterHighestLevelFormulaItems,
    getFormulaRecipeKey,
} from '../src/player/utils/formulaBookUtils.js';

test('formula recipe keys group known item variants by base name', () => {
    assert.equal(getFormulaRecipeKey({ name: 'Alchemist Fire (Lesser)' }), 'alchemist fire');
    assert.equal(getFormulaRecipeKey({ name: 'Alchemist Fire (Moderate)' }), 'alchemist fire');
    assert.equal(getFormulaRecipeKey({ name: 'Magic Wand (1st-Rank Spell)' }), 'magic wand (1st-rank spell)');
});

test('highest-level formula filter keeps only the strongest known variant', () => {
    const items = [
        { name: 'Alchemist Fire (Lesser)', level: 1, type: 'Bomb' },
        { name: 'Rope', level: 0, type: 'Adventuring Gear' },
        { name: 'Alchemist Fire (Moderate)', level: 3, type: 'Bomb' },
        { name: 'Bottled Lightning (Lesser)', level: 1, type: 'Bomb' },
        { name: 'Bottled Lightning (Greater)', level: 11, type: 'Bomb' },
    ];

    const filtered = filterHighestLevelFormulaItems(items, true);
    assert.deepEqual(filtered.map(item => item.name), [
        'Alchemist Fire (Moderate)',
        'Rope',
        'Bottled Lightning (Greater)',
    ]);
});

test('formula type filter works after highest-level filtering', () => {
    const items = filterHighestLevelFormulaItems([
        { name: 'Alchemist Fire (Lesser)', level: 1, type: 'Bomb' },
        { name: 'Alchemist Fire (Moderate)', level: 3, type: 'Bomb' },
        { name: 'Rope', level: 0, type: 'Adventuring Gear' },
    ], true);

    assert.deepEqual(filterFormulaItemsByType(items, 'Bomb').map(item => item.name), ['Alchemist Fire (Moderate)']);
    assert.deepEqual(filterFormulaItemsByType(items, 'all').map(item => item.name), ['Alchemist Fire (Moderate)', 'Rope']);
});
