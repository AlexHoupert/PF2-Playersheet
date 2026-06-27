import test from 'node:test';
import assert from 'node:assert/strict';
import {
    findInventoryItemIndex,
    findStackableInventoryItemIndex,
    getItemIdentityKey,
    resolveInventoryItemIdentity,
    sameInventoryItem,
} from '../src/shared/utils/itemIdentity.js';

test('inventory identity resolves duplicate names by instance id first', () => {
    const inventory = [
        { instanceId: 'sword-a', name: 'Longsword', equipped: false },
        { instanceId: 'sword-b', name: 'Longsword', equipped: true },
    ];

    assert.equal(findInventoryItemIndex(inventory, { instanceId: 'sword-b', name: 'Longsword' }), 1);
    assert.equal(resolveInventoryItemIdentity(inventory, { instanceId: 'sword-a' }).item.equipped, false);
});

test('inventory identity keeps legacy index and addedAt fallback in one resolver', () => {
    const inventory = [
        { name: 'Bomb', addedAt: 100, equipped: false, prepared: false },
        { name: 'Bomb', addedAt: 200, equipped: false, prepared: false },
    ];

    assert.equal(findInventoryItemIndex(inventory, { _index: 1, name: 'Bomb', addedAt: 200 }), 1);
    assert.equal(findInventoryItemIndex(inventory, { name: 'Bomb', addedAt: 100 }), 0);
    assert.equal(sameInventoryItem(inventory[1], { name: 'Bomb', addedAt: 200 }), true);
});

test('stackable identity intentionally groups unequipped matching stacks', () => {
    const inventory = [
        { instanceId: 'arrow-a', name: 'Arrow', qty: 2, equipped: false },
        { instanceId: 'arrow-b', name: 'Arrow', qty: 1, equipped: true },
    ];

    assert.equal(findStackableInventoryItemIndex(inventory, { name: 'Arrow' }, { equipped: false }), 0);
    assert.equal(findStackableInventoryItemIndex(inventory, { name: 'Arrow' }, { excludeIndex: 0 }), 1);
});

test('item selection keys prefer instance ids over name fallbacks', () => {
    assert.equal(getItemIdentityKey({ instanceId: 'loot-a', id: 'base', name: 'Potion' }), 'loot-a');
    assert.equal(getItemIdentityKey({ id: 'base', name: 'Potion' }), 'base');
    assert.equal(getItemIdentityKey({ name: 'Potion' }), 'Potion');
});
