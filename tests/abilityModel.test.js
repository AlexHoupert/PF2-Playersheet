import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeAbilityCatalogEntry,
    normalizeAbilityCatalogList,
} from '../src/shared/catalog/abilityModel.js';

test('ability catalog normalization repairs incomplete legacy entries', () => {
    assert.deepEqual(normalizeAbilityCatalogEntry({ id: 'legacy', name: 'Legacy Aura' }), {
        id: 'legacy',
        _id: 'legacy',
        name: 'Legacy Aura',
        typeCode: 'P',
        traits: [],
        category: '',
        description: '',
    });
});

test('ability catalog normalization reads Foundry-shaped fields', () => {
    const ability = normalizeAbilityCatalogEntry({
        _id: 'foundry-action',
        name: 'Smoke Step',
        type: 'action',
        system: {
            actionType: { value: 'action' },
            actions: { value: 2 },
            traits: { value: ['move', 'fire'] },
            category: 'offensive',
            description: { value: '<p>Stride through smoke.</p>' },
        },
    });

    assert.equal(ability.typeCode, '2');
    assert.deepEqual(ability.traits, ['move', 'fire']);
    assert.equal(ability.category, 'offensive');
    assert.equal(ability.description, '<p>Stride through smoke.</p>');
});

test('ability catalog list ignores malformed records and accepts object maps', () => {
    const abilities = normalizeAbilityCatalogList({
        missing: null,
        unnamed: { id: 'unnamed' },
        valid: { id: 'valid', name: 'Valid Ability', traits: { value: ['visual'] } },
    });

    assert.equal(abilities.length, 1);
    assert.equal(abilities[0].name, 'Valid Ability');
    assert.deepEqual(abilities[0].traits, ['visual']);
});
