import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getWeaponAmmunitionKind,
    isAmmunitionItem,
    isBasicAmmunitionItem,
    isCompatibleAmmunition,
} from '../src/shared/utils/ammunitionUtils.js';

const universalRounds = { name: 'Rounds (Universal)', type: 'Ammo', qty: 10 };

test('universal rounds are normalized as basic ammunition', () => {
    assert.equal(isAmmunitionItem(universalRounds), true);
    assert.equal(isBasicAmmunitionItem(universalRounds), true);
});

test('universal rounds load firearms even when legacy weapon fields are incomplete', () => {
    assert.equal(getWeaponAmmunitionKind({ name: 'Jezail' }), 'round');
    assert.equal(getWeaponAmmunitionKind({ name: 'Slide Pistol' }), 'round');
    assert.equal(isCompatibleAmmunition({ name: 'Jezail' }, universalRounds), true);
    assert.equal(isCompatibleAmmunition({ name: 'Slide Pistol' }, universalRounds), true);
});

test('weapon ammunition matching keeps arrows and bolts distinct', () => {
    const arrows = { name: 'Arrows', type: 'ammunition', qty: 10 };
    const bolts = { name: 'Bolts', type: 'ammunition', qty: 10 };

    assert.equal(isCompatibleAmmunition({ name: 'Longbow' }, arrows), true);
    assert.equal(isCompatibleAmmunition({ name: 'Longbow' }, bolts), false);
    assert.equal(isCompatibleAmmunition({ name: 'Crossbow' }, bolts), true);
    assert.equal(isCompatibleAmmunition({ name: 'Crossbow' }, arrows), false);
});
