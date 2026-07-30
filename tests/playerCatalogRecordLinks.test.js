import test from 'node:test';
import assert from 'node:assert/strict';

import { findLinkedCatalogRecordIndex } from '../src/shared/catalog/catalogRecordIdentity.js';
import { replaceLinkedCatalogRecord } from '../src/player/catalog/playerCatalogRecordLinks.js';

test('missing optional catalog ids never match unrelated legacy records', () => {
    const records = [
        { name: 'Scatter Scree', level: '0' },
        { name: 'Glamorize', level: '0' },
        { name: 'Needle Darts', level: '0' },
    ];

    assert.equal(findLinkedCatalogRecordIndex(records, { name: 'Glamorize', level: '0' }), 1);
});

test('editing one legacy spell replaces only its selected actor record', () => {
    const character = {
        magic: {
            slots: {},
            list: [
                { name: 'Scatter Scree', level: '0' },
                { name: 'Glamorize', level: '0' },
                { name: 'Needle Darts', level: '0' },
            ],
        },
    };

    replaceLinkedCatalogRecord(
        character,
        'spell',
        { name: 'Glamorize', level: '0', _actorRecordIndex: 1 },
        { name: 'Glamorize', level: 0, rules: { effectDefinitions: [{ id: 'performance' }] } },
        'campaign-spell-glamorize'
    );

    assert.deepEqual(character.magic.list.map(spell => spell.name), [
        'Scatter Scree',
        'Glamorize',
        'Needle Darts',
    ]);
    assert.equal(character.magic.list[0].catalogEntryId, undefined);
    assert.equal(character.magic.list[1].catalogEntryId, 'campaign-spell-glamorize');
    assert.equal(character.magic.list[2].catalogEntryId, undefined);
    assert.equal(character.magic.list[1]._actorRecordIndex, undefined);
});

test('duplicate legacy names use the explicit actor record index', () => {
    const records = [
        { name: 'Heal', level: '1' },
        { name: 'Heal', level: '2' },
    ];

    assert.equal(findLinkedCatalogRecordIndex(records, {
        name: 'Heal',
        level: '2',
        _actorRecordIndex: 1,
    }), 1);
});
