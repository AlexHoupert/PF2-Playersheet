import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addItemsToTraderInDb,
    clearRootNotificationInDb,
    createTraderInDb,
    deleteCreatureInDb,
    deleteCustomActionInDb,
    deleteCustomAbilityInDb,
    deleteCustomItemInDb,
    deleteDeviantAbilityInDb,
    deleteLoreArticleInDb,
    deletePactInDb,
    initializeCreatureMetadataInDb,
    moveLoreArticleInDb,
    removeItemsFromTraderInDb,
    saveCustomActionInDb,
    saveCustomAbilityInDb,
    saveCustomCreatureInDb,
    saveCustomItemInDb,
    saveDeviantAbilityInDb,
    saveLoreArticleInDb,
    savePactInDb,
    setShopFormulaAvailableInDb,
    setShopItemAvailableInDb,
    setTraderHiddenInDb,
    updateBestiaryRevealStateInDb,
    updateCreatureMetadataInDb,
    updateCustomCreatureInDb,
    updateTraderInDb,
} from '../src/shared/db/domain/globalContentReducers.js';

test('global content reducers manage custom items and actions immutably', () => {
    const initial = { shop: { customItems: {} }, actions: {} };
    const withItem = saveCustomItemInDb(initial, { name: 'Clockwork Toy', type: 'item' });
    const withAction = saveCustomActionInDb(withItem, { name: '[gold]Parry[/gold]', type: 'action' });

    assert.equal(withItem.shop.customItems['Clockwork Toy'].type, 'item');
    assert.equal(initial.shop.customItems['Clockwork Toy'], undefined);
    assert.equal(withAction.actions['[gold]Parry[/gold]'].type, 'action');

    const withoutItem = deleteCustomItemInDb(withAction, 'Clockwork Toy');
    const withoutAction = deleteCustomActionInDb(withoutItem, '[gold]Parry[/gold]');
    assert.equal(withoutItem.shop.customItems['Clockwork Toy'], undefined);
    assert.equal(withoutAction.actions['[gold]Parry[/gold]'], undefined);
});

test('shop reducers manage traders and availability lists', () => {
    const created = createTraderInDb({}, { id: 'trader1', name: 'Market', inventory: [], category: 'General' });
    const withItems = addItemsToTraderInDb(created, 'trader1', [{ name: 'Rope' }, { name: 'Rope' }, { name: 'Torch' }]);
    const updated = updateTraderInDb(withItems, 'trader1', { category: 'Adventuring' });
    const hidden = setTraderHiddenInDb(updated, 'trader1', true);
    const removed = removeItemsFromTraderInDb(hidden, 'trader1', [{ name: 'Rope' }]);
    const available = setShopItemAvailableInDb(removed, 'Torch', true);
    const formula = setShopFormulaAvailableInDb(available, { name: 'Alchemist Fire' }, true);

    assert.deepEqual(withItems.shop.traders[0].inventory, ['Rope', 'Torch']);
    assert.equal(updated.shop.traders[0].category, 'Adventuring');
    assert.equal(hidden.shop.traders[0].hidden, true);
    assert.deepEqual(removed.shop.traders[0].inventory, ['Torch']);
    assert.deepEqual(formula.shop.availableItems, ['Torch']);
    assert.deepEqual(formula.shop.availableFormulas, ['Alchemist Fire']);
});

test('bestiary reveal reducer stores field-level reveal state', () => {
    const result = updateBestiaryRevealStateInDb({}, 'goblin', 'hp', 'public');
    assert.deepEqual(result.bestiary.creatures.goblin.revealState, { hp: 'public' });
});

test('global ability and pact reducers manage catalog records', () => {
    const withCustom = saveCustomAbilityInDb({}, { id: 'custom-trip', name: 'Trip', typeCode: '1' });
    const withDeviant = saveDeviantAbilityInDb(withCustom, { id: 'fire-spark', name: 'Spark', element: 'Fire' });
    const withPact = savePactInDb(withDeviant, { id: 'ember', name: 'Ember Pact' });

    assert.equal(withPact.abilities.custom['custom-trip'].isCustom, true);
    assert.equal(withPact.abilities.deviant['fire-spark'].element, 'Fire');
    assert.equal(withPact.pacts.ember.name, 'Ember Pact');

    const removed = deletePactInDb(
        deleteDeviantAbilityInDb(deleteCustomAbilityInDb(withPact, 'custom-trip'), 'fire-spark'),
        'ember'
    );
    assert.equal(removed.abilities.custom['custom-trip'], undefined);
    assert.equal(removed.abilities.deviant['fire-spark'], undefined);
    assert.equal(removed.pacts.ember, undefined);
});

test('lore reducers save, move, and delete articles with stable sort order', () => {
    const withArticles = [
        { id: 'a', title: 'A', category: 'history', sortOrder: 0 },
        { id: 'b', title: 'B', category: 'history', sortOrder: 1 },
    ].reduce((state, article) => saveLoreArticleInDb(state, article), {});
    const moved = moveLoreArticleInDb(withArticles, 'b', 'up');
    const deleted = deleteLoreArticleInDb(moved, 'a');

    assert.equal(moved.lore.articles.find(article => article.id === 'b').sortOrder, 0);
    assert.equal(moved.lore.articles.find(article => article.id === 'a').sortOrder, 1);
    assert.deepEqual(deleted.lore.articles.map(article => article.id), ['b']);
});

test('custom creature and metadata reducers manage bestiary records', () => {
    const saved = saveCustomCreatureInDb({}, { _id: 'custom-goblin', name: 'Goblin Boss', type: 'npc', items: [] });
    const updatedCreature = updateCustomCreatureInDb(saved, 'custom-goblin', entry => ({
        ...entry,
        data: { ...entry.data, items: [{ name: 'Roar' }] },
    }));
    const withMetadata = updateCreatureMetadataInDb(updatedCreature, 'custom-goblin', {
        id: 'custom-goblin',
        group: 'Bosses',
        bestiary: true,
    });
    const initialized = initializeCreatureMetadataInDb(withMetadata, [
        { id: 'wolf', group: 'Uncategorized', bestiary: false },
        { id: 'custom-goblin', group: 'Ignored' },
    ]);
    const removed = deleteCreatureInDb(initialized, 'custom-goblin');

    assert.equal(updatedCreature.bestiary.customCreatures['custom-goblin'].data.items[0].name, 'Roar');
    assert.equal(withMetadata.bestiary.creatures['custom-goblin'].group, 'Bosses');
    assert.equal(initialized.bestiary.creatures.wolf.group, 'Uncategorized');
    assert.equal(removed.bestiary.creatures['custom-goblin'], undefined);
    assert.equal(removed.bestiary.customCreatures['custom-goblin'], undefined);
});

test('root notification reducer removes compatibility notifications', () => {
    const result = clearRootNotificationInDb({ notificationQueue: [{ id: 1 }, { id: 2 }] }, 1);
    assert.deepEqual(result.notificationQueue, [{ id: 2 }]);
});
