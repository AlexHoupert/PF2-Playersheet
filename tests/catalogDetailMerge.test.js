import test from 'node:test';
import assert from 'node:assert/strict';
import {
    mergeCatalogDetailIntoEntry,
    mergeCreatureDetailIntoEntry,
} from '../src/shared/catalog/catalogDetailMerge.js';

test('catalog detail merge keeps fetched description when row value is empty', () => {
    const detail = {
        name: 'Healing Potion (Lesser)',
        description: '<p>Real healing text.</p>',
        range: 30,
        damage: { dice: 1, die: 'd6', damageType: 'vitality' },
    };
    const row = {
        name: 'Healing Potion (Lesser)',
        description: '',
        range: null,
    };

    const merged = mergeCatalogDetailIntoEntry(detail, row);
    assert.equal(merged.description, '<p>Real healing text.</p>');
    assert.equal(merged.range, 30);
    assert.deepEqual(merged.damage, { dice: 1, die: 'd6', damageType: 'vitality' });
});

test('catalog detail merge keeps meaningful override fields', () => {
    const detail = {
        name: 'Fireball',
        level: 3,
        description: '<p>Original text.</p>',
        traits: ['fire', 'spell'],
    };
    const override = {
        name: 'Fireball',
        level: 4,
        description: '<p>Edited text.</p>',
        traits: ['fire', 'spell', 'custom'],
    };

    const merged = mergeCatalogDetailIntoEntry(detail, override);
    assert.equal(merged.level, 4);
    assert.equal(merged.description, '<p>Edited text.</p>');
    assert.deepEqual(merged.traits, ['fire', 'spell', 'custom']);
});

test('creature detail merge preserves full fetched creature data and metadata fields', () => {
    const fetched = {
        _id: 'goblin-warrior',
        name: 'Goblin Warrior',
        type: 'npc',
        system: {
            details: {
                level: { value: 1 },
                publicNotes: '<p>Small and cruel.</p>',
            },
            attributes: {
                hp: { max: 20 },
            },
        },
        items: [{ name: 'Dogslicer' }],
    };
    const entry = {
        id: 'goblin-warrior',
        name: 'Goblin Warrior',
        level: 1,
        group: 'Goblins',
        bestiary: true,
        revealState: { hp: 'precise' },
        data: {
            system: {
                details: {
                    publicNotes: '',
                },
            },
        },
    };

    const merged = mergeCreatureDetailIntoEntry(fetched, entry);
    assert.equal(merged.group, 'Goblins');
    assert.equal(merged.bestiary, true);
    assert.deepEqual(merged.revealState, { hp: 'precise' });
    assert.equal(merged.data.system.details.publicNotes, '<p>Small and cruel.</p>');
    assert.deepEqual(merged.data.items, [{ name: 'Dogslicer' }]);
});

test('creature detail merge keeps edited creature data over fetched data', () => {
    const fetched = {
        name: 'Goblin Warrior',
        system: {
            details: {
                publicNotes: '<p>Original notes.</p>',
            },
        },
    };
    const entry = {
        id: 'goblin-warrior',
        data: {
            name: 'Goblin Warrior',
            system: {
                details: {
                    publicNotes: '<p>Edited notes.</p>',
                },
            },
        },
    };

    const merged = mergeCreatureDetailIntoEntry(fetched, entry);
    assert.equal(merged.data.system.details.publicNotes, '<p>Edited notes.</p>');
});
