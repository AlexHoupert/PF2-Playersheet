import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCreatureTableSummary,
    formatTypedCreatureValues,
    getCreatureSkillBonus,
} from '../src/shared/bestiary/creatureTableSummary.js';

test('creature table summary extracts defenses, skills, attacks, magic, and shield capability', () => {
    const summary = buildCreatureTableSummary({
        system: {
            attributes: {
                ac: { value: 22 },
                hp: { max: 85 },
                speed: { value: 30 },
                resistances: [{ type: 'fire', value: 5 }],
                weaknesses: [{ type: 'cold', value: 7 }],
                immunities: [{ type: 'poison' }],
            },
            saves: {
                fortitude: { value: 14 },
                reflex: { value: 11 },
                will: { value: 9 },
            },
            perception: { mod: 12 },
            traits: { size: { value: 'lg' } },
            skills: {
                athletics: { base: 16 },
                stealth: { base: 10 },
            },
        },
        items: [
            { type: 'melee', name: 'Claw', system: { range: null } },
            { type: 'melee', name: 'Longbow', system: { range: { increment: 100 } } },
            { type: 'spellcastingEntry', name: 'Primal Prepared Spells', system: { prepared: { value: 'prepared' } } },
            { type: 'action', name: 'Raise a Shield', system: {} },
        ],
    });

    assert.equal(summary.ac, 22);
    assert.equal(summary.hp, 85);
    assert.equal(summary.size, 'lg');
    assert.equal(summary.hasMelee, true);
    assert.equal(summary.hasRanged, true);
    assert.equal(summary.hasMagic, true);
    assert.equal(summary.hasShield, true);
    assert.deepEqual(summary.spellcastingModes, ['prepared']);
    assert.equal(getCreatureSkillBonus(summary, 'athletics'), 16);
    assert.equal(formatTypedCreatureValues(summary.resistances), 'fire 5');
});

test('creature table summary preserves compact index summaries for custom merge paths', () => {
    const summary = buildCreatureTableSummary({
        ac: 18,
        hp: 42,
        skills: [{ key: 'arcana', label: 'Arcana', bonus: 13 }],
        resistances: [{ type: 'mental', value: 4 }],
        hasRanged: true,
        spellcastingModes: ['innate'],
    });

    assert.equal(summary.ac, 18);
    assert.equal(summary.hp, 42);
    assert.equal(summary.hasRanged, true);
    assert.equal(summary.hasMagic, true);
    assert.equal(getCreatureSkillBonus(summary, 'arcana'), 13);
    assert.deepEqual(summary.spellcastingModes, ['innate']);
});
