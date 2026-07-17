import test from 'node:test';
import assert from 'node:assert/strict';

import {
    attachCatalogEntryToCharacter,
    PLAYER_CATALOG_ATTACH_LABELS,
} from '../src/shared/db/domain/catalogActorReducers.js';

const baseCharacter = { id: 'actor-1', inventory: [], feats: [], impulses: [], actions: [], magic: { list: [], slots: {} } };

test('player catalog attach labels cover every player authoring editor', () => {
    assert.deepEqual(Object.keys(PLAYER_CATALOG_ATTACH_LABELS).sort(), ['action', 'feat', 'impulse', 'item', 'spell']);
});

test('created item is added as a distinct inventory instance', () => {
    const result = attachCatalogEntryToCharacter(baseCharacter, {
        catalogType: 'item',
        entryId: 'entry-item',
        payload: { name: 'Player Bomb', qty: 9 },
    }, { createId: () => 'instance-1' });

    assert.equal(result.inventory.length, 1);
    assert.equal(result.inventory[0].name, 'Player Bomb');
    assert.equal(result.inventory[0].qty, 1);
    assert.equal(result.inventory[0].instanceId, 'instance-1');
    assert.equal(result.inventory[0].catalogEntryId, 'entry-item');
});

test('created spell is linked to the actor spell list once', () => {
    const input = { catalogType: 'spell', entryId: 'entry-spell', payload: { name: 'Player Spell', level: 0 } };
    const first = attachCatalogEntryToCharacter(baseCharacter, input);
    const second = attachCatalogEntryToCharacter(first, input);

    assert.equal(second.magic.list.length, 1);
    assert.equal(second.magic.list[0].level, '0');
    assert.equal(second.magic.list[0].catalogEntryId, 'entry-spell');
});

test('created feats, impulses, and actions are linked once by catalog identity', () => {
    let result = baseCharacter;
    for (const catalogType of ['feat', 'impulse', 'action']) {
        const input = {
            catalogType,
            entryId: `entry-${catalogType}`,
            payload: { name: `Player ${catalogType}` },
        };
        result = attachCatalogEntryToCharacter(result, input);
        result = attachCatalogEntryToCharacter(result, input);
    }

    assert.equal(result.feats.length, 1);
    assert.equal(result.impulses.length, 1);
    assert.equal(result.actions.length, 1);
});
