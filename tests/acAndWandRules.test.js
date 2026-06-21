import test from 'node:test';
import assert from 'node:assert/strict';
import { getScalySkinAcAdjustment } from '../src/shared/utils/acRules.js';
import {
    resolveDamageEffects,
    resolveEffectModifiers,
    resolveEffectModifiersForSelectors,
    resolveResistanceWeakness,
} from '../src/shared/rules/effectResolver.js';
import {
    createCustomBadgeEffectInput,
    createPersistentDamageEffectInput,
    createStandardConditionEffectInput,
} from '../src/shared/rules/conditionEffectRules.js';
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

test('effect resolver applies typed stacking and caps', () => {
    const result = resolveEffectModifiers([
        { id: 'item1', label: 'Item 1', modifiers: [{ selector: 'ac', mode: 'bonus', bonusType: 'item', value: 1 }] },
        { id: 'item2', label: 'Item 2', modifiers: [{ selector: 'ac', mode: 'bonus', bonusType: 'item', value: 2 }] },
        { id: 'statusPenalty', label: 'Frightened', modifiers: [{ selector: 'ac', mode: 'penalty', bonusType: 'status', value: -1 }] },
        { id: 'statusBonus', label: 'Blessed', modifiers: [{ selector: 'ac', mode: 'bonus', bonusType: 'status', value: 1 }] },
        { id: 'cap', label: 'Cap', modifiers: [{ selector: 'ac.dex_cap', mode: 'cap', value: 3 }] },
    ], 'ac');
    const cap = resolveEffectModifiers([
        { id: 'cap', label: 'Cap', modifiers: [{ selector: 'ac.dex_cap', mode: 'cap', value: 3 }] },
    ], 'ac.dex_cap');

    assert.equal(result.total, 2);
    assert.deepEqual(result.breakdown, { item: 2 });
    assert.equal(cap.cap, 3);
});

test('effect resolver keeps highest persistent damage and offsets resistance weakness', () => {
    const effects = [
        { id: 'fire1', modifiers: [{ mode: 'persistent_damage', damageType: 'fire', value: 2 }] },
        { id: 'fire2', modifiers: [{ mode: 'persistent_damage', damageType: 'fire', value: 5 }] },
        { id: 'resist', modifiers: [{ mode: 'resistance', damageType: 'cold', value: 5 }] },
        { id: 'weak', modifiers: [{ mode: 'weakness', damageType: 'cold', value: 4 }] },
    ];

    assert.equal(resolveDamageEffects(effects).persistentByType.fire.value, 5);
    assert.deepEqual(resolveResistanceWeakness(effects).netByType.cold, {
        resistance: 5,
        weakness: 4,
        netResistance: 1,
        netWeakness: 0,
    });
});

test('standard condition mapping creates value modifiers for core PF2e conditions', () => {
    const frightened = createStandardConditionEffectInput('Frightened', 1);
    const sickened = createStandardConditionEffectInput('Sickened', 2);
    const clumsy = createStandardConditionEffectInput('Clumsy', 1);
    const offGuard = createStandardConditionEffectInput('Off-Guard', 1);
    const quickened = createStandardConditionEffectInput('Quickened', 1);

    assert.equal(resolveEffectModifiersForSelectors([frightened, sickened], ['save.will', 'all.checks']).total, -2);
    assert.equal(resolveEffectModifiersForSelectors([clumsy], ['ac', 'attribute.dexterity']).total, -1);
    assert.equal(resolveEffectModifiersForSelectors([offGuard], ['ac']).total, -2);
    assert.equal(quickened.modifiers.length, 0);
});

test('persistent damage and custom badges produce actor effects without false stacking', () => {
    const fireDice = createPersistentDamageEffectInput({ damageType: 'fire', mode: 'dice', diceCount: 1, dieSize: 6 });
    const fireStatic = createPersistentDamageEffectInput({ damageType: 'fire', mode: 'static', staticValue: 5 });
    const custom = createCustomBadgeEffectInput('Covered in Glue');

    assert.equal(fireDice.category, 'damage_effect');
    assert.equal(resolveDamageEffects([fireDice, fireStatic]).persistentByType.fire.formula, '5 fire persistent');
    assert.equal(custom.category, 'custom');
    assert.deepEqual(custom.modifiers, []);
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
