import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addItemsToTraderInDb,
    createTraderInDb,
    deleteCustomActionInDb,
    deleteCustomItemInDb,
    removeItemsFromTraderInDb,
    saveCustomActionInDb,
    saveCustomItemInDb,
    setShopFormulaAvailableInDb,
    setShopItemAvailableInDb,
    setTraderHiddenInDb,
    updateBestiaryRevealStateInDb,
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
