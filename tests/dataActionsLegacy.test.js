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
    assert.equal(character.gold, 2);
    assert.equal(campaign.lootBags[0].goldValue, 3);
    assert.equal(campaign.quests[0].objectives[0].completed, true);
    assert.equal(campaign.encounters[0].combatants.length, 1);
    assert.equal(campaign.maps[0].pins[0].label, 'Gate');
    assert.equal(campaign.progress.calcifer.currentProgress, 3);
    assert.equal(campaign.camping.zoneDC, 18);
});

test('legacy global actions update shop, custom content, and bestiary reveal state', async () => {
    const harness = legacyHarness({ shop: { traders: [], customItems: {} }, actions: {}, bestiary: { creatures: {} } });

    await harness.actions.globalContent.saveCustomItem({ name: 'Widget' });
    await harness.actions.globalContent.saveCustomAction({ name: '[gold]Trip[/gold]' });
    await harness.actions.shop.createTrader({ id: 'trader1', name: 'Market', inventory: [] });
    await harness.actions.shop.addItemsToTrader('trader1', [{ name: 'Widget' }]);
    await harness.actions.shop.setItemAvailable('Widget', true);
    await harness.actions.bestiary.updateRevealState('goblin', 'hp', 'public');

    assert.equal(harness.state.shop.customItems.Widget.name, 'Widget');
    assert.equal(harness.state.actions['[gold]Trip[/gold]'].name, '[gold]Trip[/gold]');
    assert.deepEqual(harness.state.shop.traders[0].inventory, ['Widget']);
    assert.deepEqual(harness.state.shop.availableItems, ['Widget']);
    assert.equal(harness.state.bestiary.creatures.goblin.revealState.hp, 'public');
});
