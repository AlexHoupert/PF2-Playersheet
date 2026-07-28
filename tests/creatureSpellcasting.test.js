import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCreatureSpellcastingModel,
    createCreatureSpellFromCatalog,
    createCreatureSpellcastingEntry,
    serializeCreatureSpellcastingModel,
} from '../src/shared/bestiary/creatureSpellcasting.js';

test('prepared creature spellcasting round-trips slots, duplicate preparation, and unknown fields', () => {
    const items = [
        {
            _id: 'entry-prepared',
            type: 'spellcastingEntry',
            name: 'Arcane Prepared Spells',
            customTopLevel: 'preserve-me',
            system: {
                prepared: { value: 'prepared', flexible: false },
                tradition: { value: 'arcane' },
                spelldc: { dc: 24, value: 16, custom: 7 },
                slots: { slot3: { max: 2, value: 2, prepared: [{ id: 'spell-fireball' }, { id: 'spell-fireball' }] } },
                autoHeightenLevel: { value: 5 },
            },
        },
        {
            _id: 'spell-fireball',
            type: 'spell',
            name: 'Fireball',
            customSpellField: true,
            system: {
                level: { value: 3 },
                location: { value: 'entry-prepared' },
                description: { value: 'Boom' },
            },
        },
        { _id: 'claw', type: 'melee', name: 'Claw', system: {} },
    ];

    const model = buildCreatureSpellcastingModel(items);
    assert.equal(model[0].mode, 'prepared');
    assert.equal(model[0].spells[0].preparedCount, 2);

    const serialized = serializeCreatureSpellcastingModel(model, items);
    const entry = serialized.find(item => item._id === 'entry-prepared');
    const spell = serialized.find(item => item._id === 'spell-fireball');
    assert.equal(entry.customTopLevel, 'preserve-me');
    assert.equal(entry.system.spelldc.custom, 7);
    assert.equal(entry.system.slots.slot3.prepared.length, 2);
    assert.equal(spell.customSpellField, true);
    assert.equal(spell.system.location.value, 'entry-prepared');
    assert.ok(serialized.some(item => item._id === 'claw'));
});

test('all supported creature spellcasting modes serialize stable Foundry entry and spell locations', () => {
    const model = ['prepared', 'spontaneous', 'innate', 'focus'].map((mode, index) => {
        const entry = createCreatureSpellcastingEntry(mode, index);
        entry.id = `entry-${mode}`;
        entry.slots = mode === 'prepared' || mode === 'spontaneous'
            ? [{ rank: 1, max: 2, value: 2 }]
            : [];
        const spell = createCreatureSpellFromCatalog(entry, { id: `spell-${mode}`, name: `${mode} spell`, rank: 1 }, 1);
        if (mode === 'innate') {
            spell.atWill = false;
            spell.usesPerDay = 3;
        }
        entry.spells = [spell];
        return entry;
    });

    const serialized = serializeCreatureSpellcastingModel(model, []);
    for (const mode of ['prepared', 'spontaneous', 'innate', 'focus']) {
        const entry = serialized.find(item => item._id === `entry-${mode}`);
        const spell = serialized.find(item => item.type === 'spell' && item.system.location.value === `entry-${mode}`);
        assert.equal(entry.system.prepared.value, mode);
        assert.ok(spell);
        if (mode === 'innate') assert.equal(spell.system.location.uses.max, 3);
        if (mode === 'focus') assert.equal(entry.system.focusPoints.max, 1);
    }
});
