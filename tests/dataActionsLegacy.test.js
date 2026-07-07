import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataActions } from '../src/shared/db/domain/createDataActions.js';

function legacyHarness(initialDb) {
    let state = structuredClone(initialDb);
    const setDb = (updater) => {
        state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    };
    const actions = createDataActions({
        db: state,
        setDb,
        mode: 'legacy',
        createId: (prefix = 'id') => `${prefix}_test`,
        actorEmail: 'gm@example.com',
    });
    return { actions, get state() { return state; } };
}

test('legacy data actions update character, inventory, loot, quest, encounter, map, progress, and camping snapshots', async () => {
    const harness = legacyHarness({
        users: {},
        campaigns: {
            camp1: {
                id: 'camp1',
                name: 'Campaign',
                characters: [{ id: 'char1', name: 'Hero', inventory: [], xp: { current: 0, max: 1000 }, gold: 0 }],
                lootBags: [{ id: 'loot1', name: 'Chest', items: [{ name: 'Rope', qty: 1 }], goldValue: 5 }],
                quests: [{ id: 'quest1', title: 'Quest', objectives: [{ text: 'Done', xp: 10 }], rewards: {} }],
                encounters: [{ id: 'enc1', name: 'Fight', combatants: [], isActive: false }],
                maps: [{ id: 'map1', name: 'Map', pins: [] }],
            },
        },
    });

    await harness.actions.character.updateCharacter('camp1', 'char1', { notes: 'ready' });
    await harness.actions.character.setGold('camp1', 'char1', 10.5);
    await harness.actions.character.adjustGold('camp1', 'char1', -2);
    await harness.actions.character.setAttribute('camp1', 'char1', 'strength', -1);
    await harness.actions.character.adjustAttribute('camp1', 'char1', 'strength', 3);
    await harness.actions.character.setMaxHp('camp1', 'char1', 20);
    await harness.actions.character.adjustMaxHp('camp1', 'char1', -5);
    await harness.actions.character.setHp('camp1', 'char1', 14);
    await harness.actions.character.adjustHp('camp1', 'char1', -4);
    await harness.actions.character.setTempHp('camp1', 'char1', 7);
    await harness.actions.character.adjustTempHp('camp1', 'char1', -2);
    await harness.actions.character.setSpeed('camp1', 'char1', 'land', 30);
    await harness.actions.character.adjustSpeed('camp1', 'char1', 'land', -5);
    await harness.actions.character.setClassDc('camp1', 'char1', 18);
    await harness.actions.character.adjustClassDc('camp1', 'char1', 1);
    await harness.actions.character.setDailyCraftingMax('camp1', 'char1', 6);
    await harness.actions.inventory.addItem('camp1', 'char1', { name: 'Torch', type: 'consumable' });
    await harness.actions.loot.claimGold('camp1', 'loot1', 'char1', 2);
    await harness.actions.quest.toggleObjective('camp1', 'quest1', 0, true);
    await harness.actions.encounter.addCombatant('camp1', 'enc1', 'player', { id: 'char1', name: 'Hero', stats: { hp: { current: 5, max: 5 } } });
    await harness.actions.map.upsertPin('camp1', 'map1', { id: 'pin1', label: 'Gate', x: 0.1, y: 0.2 });
    await harness.actions.progress.updateProgress('camp1', { calcifer: { currentProgress: 3 } });
    await harness.actions.camping.updateSettings('camp1', { zoneDC: 18 });

    const campaign = harness.state.campaigns.camp1;
    const character = campaign.characters[0];
    assert.equal(character.notes, 'ready');
    assert.equal(character.inventory.some(item => item.name === 'Torch'), true);
    assert.equal(character.gold, 10.5);
    assert.equal(character.stats.attributes.strength, 2);
    assert.equal(character.stats.hp.max, 15);
    assert.equal(character.stats.hp.current, 10);
    assert.equal(character.stats.hp.temp, 5);
    assert.equal(character.stats.speed.land, 25);
    assert.equal(character.stats.class_dc, 19);
    assert.equal(character.dailyCraftingMax, 6);
    assert.equal(campaign.lootBags[0].goldValue, 3);
    assert.equal(campaign.quests[0].objectives[0].completed, true);
    assert.equal(campaign.encounters[0].combatants.length, 1);
    assert.equal(campaign.maps[0].pins[0].label, 'Gate');
    assert.equal(campaign.progress.calcifer.currentProgress, 3);
    assert.equal(campaign.camping.zoneDC, 18);
});

test('legacy global actions update shop, custom content, bestiary, lore, and pacts', async () => {
    const harness = legacyHarness({
        shop: { traders: [], customItems: {} },
        actions: {},
        bestiary: { creatures: {}, customCreatures: {} },
        lore: { articles: [{ id: 'article1', title: 'First', category: 'history', sortOrder: 0 }] },
        abilities: { custom: {}, deviant: {} },
        pacts: {},
        notificationQueue: [{ id: 'notice1' }],
    });

    await harness.actions.globalContent.saveCustomItem({ name: 'Widget' });
    await harness.actions.globalContent.saveCustomAction({ name: '[gold]Trip[/gold]' });
    await harness.actions.globalContent.saveCustomAbility({ id: 'custom-trip', name: 'Trip' });
    await harness.actions.globalContent.saveLoreArticle({ id: 'article2', title: 'Second', category: 'history', sortOrder: 1 });
    await harness.actions.globalContent.moveLoreArticle('article2', 'up');
    await harness.actions.globalContent.clearRootNotification('notice1');
    await harness.actions.pact.savePact({ id: 'ember', name: 'Ember Pact' });
    await harness.actions.pact.saveDeviantAbility({ id: 'spark', name: 'Spark', element: 'Fire' });
    await harness.actions.bestiary.saveCustomCreature({ _id: 'custom-goblin', name: 'Goblin Boss', type: 'npc', items: [] });
    await harness.actions.bestiary.updateCustomCreature('custom-goblin', entry => ({
        ...entry,
        data: { ...entry.data, items: [{ name: 'Roar' }] },
    }));
    await harness.actions.bestiary.updateCreatureMetadata('custom-goblin', { id: 'custom-goblin', group: 'Bosses' });
    await harness.actions.bestiary.initializeCreatureMetadata([{ id: 'wolf', group: 'Wolves' }]);
    await harness.actions.shop.createTrader({ id: 'trader1', name: 'Market', inventory: [] });
    await harness.actions.shop.addItemsToTrader('trader1', [{ name: 'Widget' }]);
    await harness.actions.shop.setItemAvailable('Widget', true);
    await harness.actions.bestiary.updateRevealState('goblin', 'hp', 'public');

    assert.equal(harness.state.shop.customItems.Widget.name, 'Widget');
    assert.equal(harness.state.actions['[gold]Trip[/gold]'].name, '[gold]Trip[/gold]');
    assert.equal(harness.state.abilities.custom['custom-trip'].name, 'Trip');
    assert.equal(harness.state.abilities.deviant.spark.element, 'Fire');
    assert.equal(harness.state.pacts.ember.name, 'Ember Pact');
    assert.equal(harness.state.lore.articles.find(article => article.id === 'article2').sortOrder, 0);
    assert.deepEqual(harness.state.notificationQueue, []);
    assert.equal(harness.state.bestiary.customCreatures['custom-goblin'].data.items[0].name, 'Roar');
    assert.equal(harness.state.bestiary.creatures['custom-goblin'].group, 'Bosses');
    assert.equal(harness.state.bestiary.creatures.wolf.group, 'Wolves');
    assert.deepEqual(harness.state.shop.traders[0].inventory, ['Widget']);
    assert.deepEqual(harness.state.shop.availableItems, ['Widget']);
    assert.equal(harness.state.bestiary.creatures.goblin.revealState.hp, 'public');
});

test('legacy pact offer flow sets offers, accepts valid abilities, and spends awakening points', async () => {
    const harness = legacyHarness({
        abilities: {
            custom: {},
            deviant: {
                spark: {
                    id: 'spark',
                    name: 'Spark',
                    element: 'Fire',
                    level: 1,
                    awakening1: { name: 'Bright Spark' },
                },
                inferno: { id: 'inferno', name: 'Inferno', element: 'Fire', level: 6 },
            },
        },
        pacts: {
            ember: {
                id: 'ember',
                name: 'Ember Pact',
                dedication: { type: 'feat', id: 'ember-dedication', name: 'Ember Dedication' },
                abilityGroups: [
                    { label: 'Initial', abilityIds: ['spark'] },
                    { label: 'Level 6', abilityIds: ['inferno'] },
                ],
            },
        },
        campaigns: {
            camp1: {
                id: 'camp1',
                name: 'Campaign',
                characters: [
                    { id: 'char1', name: 'Hero', level: 1 },
                    { id: 'char2', name: 'Bound', level: 1, pact: { pactId: 'other' } },
                ],
            },
        },
    });

    await harness.actions.pact.offerPactToActors('camp1', ['char1', 'char2'], 'ember');
    assert.equal(harness.state.campaigns.camp1.characters[0].pactOffer.pactId, 'ember');
    assert.equal(harness.state.campaigns.camp1.characters[1].pactOffer, undefined);

    await harness.actions.pact.rejectPactOffer('camp1', 'char1', harness.state.campaigns.camp1.characters[0].pactOffer.id);
    assert.equal(harness.state.campaigns.camp1.characters[0].pactOffer, undefined);

    await harness.actions.pact.offerPactToActors('camp1', ['char1'], 'ember');
    await harness.actions.pact.acceptPactOffer('camp1', 'char1', harness.state.campaigns.camp1.characters[0].pactOffer.id, 'spark');
    const character = harness.state.campaigns.camp1.characters[0];
    assert.equal(character.pact.pactId, 'ember');
    assert.equal(character.pact.dedicationId, 'ember-dedication');
    assert.equal(character.pact.choices[0], 'spark');
    assert.equal(character.pactOffer, undefined);

    await harness.actions.pact.grantAwakeningPoints('camp1', 'char1', 1);
    await harness.actions.pact.spendAwakeningPoint('camp1', 'char1', 'spark', 1);
    assert.equal(harness.state.campaigns.camp1.characters[0].pact.awakeningPoints, 0);
    assert.equal(harness.state.campaigns.camp1.characters[0].pact.unlockedAwakenings.spark, 1);
});
