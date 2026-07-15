import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMasterToV2 } from '../src/shared/db/v2/normalizers.js';
import { composeLegacyDbFromV2Documents } from '../src/shared/db/v2/legacyProjection.js';
import { composeV2ViewModelFromDocuments } from '../src/shared/db/v2/viewModel.js';
import { V2_SCHEMA_VERSION } from '../src/shared/db/v2/schema.js';

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
                    skills: { Intimidate: 2, Perform: 4 },
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
    assert.equal(result.schemaVersion, V2_SCHEMA_VERSION);
    assert(paths.has('campaigns/camp1'));
    assert(paths.has('campaigns/camp1/characters/char1'));
    assert(paths.has('campaigns/camp1/actors/char1'));
    assert(paths.has('campaigns/camp1/actorEffects/char1_frightened_0'));
    assert(paths.has('campaigns/camp1/quests/quest1'));
    assert(paths.has('campaigns/camp1/lootBags/loot1'));
    assert(paths.has('campaigns/camp1/members/player@example.com'));
    assert(paths.has('customItems/Widget'));
    assert(paths.has('customActions/Shove'));
    assert(paths.has('catalogOverrides/item_Widget'));
    assert(paths.has('catalogOverrides/action_Shove'));
    assert(paths.has('catalogOverrides/ability_customTrip'));
    assert(paths.has('catalogOverrides/ability_spark'));
    assert(paths.has('loreArticles/article1'));

    const globalConfig = result.documents.find(doc => doc.path === 'global/config').data;
    assert.equal(globalConfig.abilities.custom.customTrip.name, 'Trip');
    assert.equal(globalConfig.abilities.deviant.spark.name, 'Spark');
    assert.equal(globalConfig.pacts.ember.name, 'Ember Pact');

    const characterDoc = result.documents.find(doc => doc.path === 'campaigns/camp1/characters/char1').data;
    assert.deepEqual(characterDoc.stats.hp, { current: 12, max: 20, temp: 0 });
    assert.equal(characterDoc.hp, undefined);
    assert.deepEqual(characterDoc.conditions, [{ name: 'frightened', level: 1 }]);
    assert.equal(characterDoc.skills.Intimidation, 2);
    assert.equal(characterDoc.skills.Performance, 4);
    assert.equal(characterDoc.skills.Intimidate, undefined);
    assert.equal(characterDoc.skills.Perform, undefined);
    assert.deepEqual(characterDoc.impulses, []);
    assert.equal(characterDoc.isKineticist, false);
    assert.equal(characterDoc.isCaster, false);
    assert.equal(characterDoc.stats.impulse_proficiency, 0);
    assert.equal(characterDoc.stats.spell_proficiency, 0);
    assert.equal(characterDoc.inventory[0].catalogRef.name, 'Rope');
    assert.equal(characterDoc.inventory[1].qty, 2);
    assert(characterDoc.inventory.every(item => item.instanceId));
    assert.deepEqual(characterDoc.inventory[1].traits.value, ['ranged', 'martial']);
    assert.deepEqual(characterDoc.proficiencies, { Unarmored: 2 });

    const actorDoc = result.documents.find(doc => doc.path === 'campaigns/camp1/actors/char1').data;
    assert.equal(actorDoc.kind, 'pc');
    assert.equal(actorDoc.sheet.legacyCharacterId, 'char1');
    assert.equal(actorDoc.stats.hp.current, 12);

    const effectDoc = result.documents.find(doc => doc.path === 'campaigns/camp1/actorEffects/char1_frightened_0').data;
    assert.equal(effectDoc.category, 'condition');
    assert.equal(effectDoc.targetActorId, 'char1');
    assert.equal(effectDoc.label, 'frightened');

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
    assert.equal(db.campaigns.camp1.actors[0].id, 'char1');
    assert.equal(db.campaigns.camp1.characters[0].id, 'char1');
    assert.deepEqual(db.campaigns.camp1.characters[0].conditions, []);
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
        actorId: 'char1',
    });
});

test('legacy projection prefers pc actor sheet over stale character documents', () => {
    const db = composeLegacyDbFromV2Documents([
        { path: 'campaigns/camp1', data: { id: 'camp1', name: 'Campaign One' } },
        { path: 'campaigns/camp1/characters/char1', data: { id: 'char1', name: 'Stale Hero', gold: 0 } },
        {
            path: 'campaigns/camp1/actors/char1',
            data: {
                id: 'char1',
                kind: 'pc',
                name: 'Actor Hero',
                level: 3,
                sheet: { id: 'char1', name: 'Actor Hero', gold: 9 },
                stats: { hp: { current: 7, max: 20, temp: 0 } },
                inventory: [],
                magic: { slots: {}, list: [] },
            },
        },
    ]);

    assert.equal(db.campaigns.camp1.characters.length, 1);
    assert.equal(db.campaigns.camp1.characters[0].name, 'Actor Hero');
    assert.equal(db.campaigns.camp1.characters[0].gold, 9);
    assert.equal(db.campaigns.camp1.characters[0].stats.hp.current, 7);
});

test('composes normalized documents into a v2-native view model', () => {
    const result = normalizeMasterToV2({
        campaigns: {
            camp1: {
                id: 'camp1',
                name: 'Campaign One',
                characters: [{
                    id: 'char1',
                    name: 'Hero',
                    conditions: [{ name: 'Frightened', level: 1 }],
                    companion: { id: 'wolf1', name: 'Wolf', type: 'animal' },
                }],
                quests: [{ id: 'quest1', title: 'Find the Key' }],
            },
        },
        shop: { customItems: { Widget: { name: 'Widget' } } },
    }, {
        now: 0,
        migrationId: 'test_v2_view',
    });

    const view = composeV2ViewModelFromDocuments([
        ...result.documents,
        {
            path: 'campaigns/camp1/effectTemplates/template1',
            collection: 'effectTemplates',
            data: { id: 'template1', label: 'Sickened' },
        },
    ]);

    assert.equal(view.campaigns.camp1.name, 'Campaign One');
    assert.deepEqual(view.campaigns.camp1.actorsList.map(actor => actor.id), ['char1', 'wolf1']);
    assert.deepEqual(view.campaigns.camp1.actorEffectsList.map(effect => effect.targetActorId), ['char1']);
    assert.deepEqual(view.campaigns.camp1.effectTemplatesList.map(template => template.id), ['template1']);
    assert.deepEqual(view.campaigns.camp1.questsList.map(quest => quest.id), ['quest1']);
    assert.equal(view.customItems.Widget.name, 'Widget');
    assert.equal(view.catalogOverrides.item_Widget.catalogType, 'item');
});
