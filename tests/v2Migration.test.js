import test from 'node:test';
import assert from 'node:assert/strict';
import { composeLegacyDbFromV2Documents, normalizeMasterToV2 } from '../src/shared/db/v2/normalizers.js';

test('normalizes legacy master data into campaign-scoped v2 documents', () => {
    const master = {
        campaigns: {
            camp1: {
                id: 'camp1',
                name: 'Campaign One',
                characters: [{
                    id: 'char1',
                    name: 'Hero',
                    level: '3',
                    hp: { current: 12, max: 20 },
                    conditions: ['frightened'],
                    inventory: [
                        'Rope',
                        { name: 'Shortbow', quantity: 2, traits: 'ranged, martial' },
                    ],
                    proficiencies: [{ name: 'Unarmored', prof: 2 }],
                }],
            },
        },
        quests: [{ id: 'quest1', title: 'Find the Key', objectives: [], rewards: {} }],
        lootBags: [{ id: 'loot1', name: 'Chest', items: ['Coin'], goldValue: '5' }],
        users: {
            'PLAYER@EXAMPLE.COM': { role: 'player', campaignId: 'camp1', characterId: 'char1' },
        },
        shop: {
            availableItems: ['Rope'],
            availableFormulas: [],
            traders: [],
            customItems: {
                Widget: { name: 'Widget', system: { traits: { value: ['custom'] } } },
            },
        },
        actions: {
            Shove: { name: 'Shove', description: 'Push a target.' },
        },
        lore: {
            articles: [{ id: 'article1', title: 'Lore' }],
        },
        abilities: {
            custom: { customTrip: { id: 'customTrip', name: 'Trip' } },
            deviant: { spark: { id: 'spark', name: 'Spark' } },
        },
        pacts: {
            ember: { id: 'ember', name: 'Ember Pact' },
        },
    };

    const result = normalizeMasterToV2(master, {
        now: 0,
        migrationId: 'test_migration',
    });

    const paths = new Set(result.documents.map(doc => doc.path));
    assert.equal(result.schemaVersion, 2);
    assert(paths.has('campaigns/camp1'));
    assert(paths.has('campaigns/camp1/characters/char1'));
    assert(paths.has('campaigns/camp1/quests/quest1'));
    assert(paths.has('campaigns/camp1/lootBags/loot1'));
    assert(paths.has('campaigns/camp1/members/player@example.com'));
    assert(paths.has('customItems/Widget'));
    assert(paths.has('customActions/Shove'));
    assert(paths.has('loreArticles/article1'));

    const globalConfig = result.documents.find(doc => doc.path === 'global/config').data;
    assert.equal(globalConfig.abilities.custom.customTrip.name, 'Trip');
    assert.equal(globalConfig.abilities.deviant.spark.name, 'Spark');
    assert.equal(globalConfig.pacts.ember.name, 'Ember Pact');

    const characterDoc = result.documents.find(doc => doc.path === 'campaigns/camp1/characters/char1').data;
    assert.deepEqual(characterDoc.stats.hp, { current: 12, max: 20, temp: 0 });
    assert.equal(characterDoc.hp, undefined);
    assert.deepEqual(characterDoc.conditions, [{ name: 'frightened', level: 1 }]);
    assert.equal(characterDoc.inventory[0].catalogRef.name, 'Rope');
    assert.equal(characterDoc.inventory[1].qty, 2);
    assert(characterDoc.inventory.every(item => item.instanceId));
    assert.deepEqual(characterDoc.inventory[1].traits.value, ['ranged', 'martial']);
    assert.deepEqual(characterDoc.proficiencies, { Unarmored: 2 });

    const lootDoc = result.documents.find(doc => doc.path === 'campaigns/camp1/lootBags/loot1').data;
    assert(lootDoc.items.every(item => item.instanceId));

    assert.equal(result.report.movedFields.length, 2);
    assert(result.report.renamedFields.some(entry => entry.from.endsWith('.hp') && entry.to.endsWith('.stats.hp')));
});

test('composes v2 documents back into the legacy projection used by existing screens', () => {
    const result = normalizeMasterToV2({
        campaigns: {
            camp1: {
                id: 'camp1',
                name: 'Campaign One',
                characters: [{ id: 'char1', name: 'Hero' }],
                quests: [{ id: 'quest1', title: 'Find the Key' }],
                maps: [
                    { id: 'map-last', name: 'Zeta', order: 2000 },
                    { id: 'map-first', name: 'Alpha', order: 1000 },
                ],
            },
        },
        users: {
            'player@example.com': { role: 'player', campaignId: 'camp1', characterId: 'char1' },
        },
        abilities: {
            custom: { customTrip: { id: 'customTrip', name: 'Trip' } },
            deviant: { spark: { id: 'spark', name: 'Spark' } },
        },
        pacts: {
            ember: { id: 'ember', name: 'Ember Pact' },
        },
    }, {
        now: 0,
        migrationId: 'test_projection',
    });

    const db = composeLegacyDbFromV2Documents(result.documents);

    assert.equal(db.campaigns.camp1.name, 'Campaign One');
    assert.equal(db.campaigns.camp1.characters[0].id, 'char1');
    assert.equal(db.campaigns.camp1.quests[0].id, 'quest1');
    assert.deepEqual(db.campaigns.camp1.maps.map(map => map.id), ['map-first', 'map-last']);
    assert.equal(db.quests[0].id, 'quest1');
    assert.equal(db.abilities.custom.customTrip.name, 'Trip');
    assert.equal(db.abilities.deviant.spark.name, 'Spark');
    assert.equal(db.pacts.ember.name, 'Ember Pact');
    assert.deepEqual(db.users['player@example.com'], {
        role: 'player',
        campaignId: 'camp1',
        characterId: 'char1',
    });
});
