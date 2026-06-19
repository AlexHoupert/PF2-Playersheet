import test from 'node:test';
import assert from 'node:assert/strict';
import { getScalySkinAcAdjustment } from '../src/shared/utils/acRules.js';
import {
    consumeWandCharge,
    getWandCharges,
    getWandMaxCharges,
    getWandSpellCasts,
    isWandItem,
    normalizeWandState,
    rechargeWand,
} from '../src/shared/utils/wandUtils.js';

test('scaly skin grants unarmored AC bonus with dex cap', () => {
    const character = { feats: ['Scaly Skin'] };

    const lowLevel = getScalySkinAcAdjustment({
        character,
        equippedArmor: null,
        profKey: 'Unarmored',
        level: 4,
        armorDexCap: 99,
    });
    assert.equal(lowLevel.active, true);
    assert.equal(lowLevel.bonus, 1);
    assert.equal(lowLevel.dexCap, 3);

    const fifthLevel = getScalySkinAcAdjustment({
        character,
        equippedArmor: null,
        profKey: 'Unarmored',
        level: 5,
        armorDexCap: 99,
    });
    assert.equal(fifthLevel.bonus, 2);
});

test('scaly skin works with explorers clothing but not real armor', () => {
    const character = { feats: [{ name: 'Scaly Skin' }] };

    const clothing = getScalySkinAcAdjustment({
        character,
        equippedArmor: { name: "Explorer's Clothing", category: 'Unarmored' },
        profKey: 'Unarmored',
        level: 5,
        armorDexCap: 5,
    });
    assert.equal(clothing.active, true);
    assert.equal(clothing.bonus, 2);
    assert.equal(clothing.dexCap, 3);

    const lightArmor = getScalySkinAcAdjustment({
        character,
        equippedArmor: { name: 'Leather Armor', category: 'Light Armor' },
        profKey: 'Light',
        level: 5,
        armorDexCap: 4,
    });
    assert.equal(lightArmor.active, false);
    assert.equal(lightArmor.bonus, 0);
    assert.equal(lightArmor.dexCap, 4);
});

test('wands consume and recharge charges without becoming consumable stacks', () => {
    const wand = {
        name: 'Wand of Heal (Rank 1)',
        type: 'Consumable',
        system: {
            spell: { name: 'Heal', level: 1 },
            wand: { charges: 1, max: 1 },
        },
    };

    assert.equal(isWandItem(wand), true);
    assert.equal(consumeWandCharge(wand), true);
    assert.equal(wand.system.wand.charges, 0);
    assert.equal(wand.name, 'Wand of Heal (Rank 1)');

    assert.equal(consumeWandCharge(wand), false);
    assert.equal(wand.system.wand.charges, 0);

    rechargeWand(wand);
    assert.equal(wand.system.wand.charges, 1);
});

test('old wand records normalize to one reusable charge', () => {
    const oldWand = {
        name: 'Wand of Heal (Rank 1)',
        system: { spell: { name: 'Heal', level: 1 } },
    };

    assert.equal(isWandItem(oldWand), true);
    assert.equal(getWandMaxCharges(oldWand), 1);
    assert.equal(getWandCharges(oldWand), 1);

    const normalized = normalizeWandState(oldWand);
    assert.deepEqual(normalized.system.wand, { max: 1, charges: 1 });
});

test('wand spell casts aggregate by spell and rank', () => {
    const inventory = [
        { name: 'Wand of Heal A', system: { spell: { name: 'Heal', level: 1 }, wand: { charges: 1, max: 1 } } },
        { name: 'Wand of Heal B', system: { spell: { name: 'Heal', level: 1 }, wand: { charges: 0, max: 1 } } },
        { name: 'Wand of Heal C', system: { spell: { name: 'Heal', level: 1 }, wand: { charges: 1, max: 1 } } },
        { name: 'Scroll of Heal', type: 'Consumable', system: { spell: { name: 'Heal', level: 1 } } },
    ];

    const groups = getWandSpellCasts(inventory);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].spell.name, 'Heal');
    assert.equal(groups[0].level, '1');
    assert.equal(groups[0].available, 2);
    assert.equal(groups[0].total, 3);
    assert.equal(groups[0].openItem.name, 'Wand of Heal A');
    assert.equal(isWandItem(inventory[3]), false);
});
