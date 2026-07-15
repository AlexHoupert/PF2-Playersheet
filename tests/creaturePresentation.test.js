import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBestiaryCreatureEntries,
    buildCreatureSkillViewModel,
    buildCreatureViewModel,
    selectVisibleCreatureFields,
} from '../src/shared/bestiary/creaturePresentation.js';

test('creature reveal helper returns precise gm data and redacted player data', () => {
    const creature = buildCreatureViewModel(
        { id: 'wolf', name: 'Wolf', level: 1 },
        { revealState: { name: 'hidden', level: 'hidden' } }
    );

    assert.deepEqual(selectVisibleCreatureFields(creature, 'gm'), {
        name: 'Wolf',
        level: 1,
        nameVisible: true,
        levelVisible: true,
        revealState: creature.revealState,
    });

    assert.equal(selectVisibleCreatureFields(creature, 'player').name, '???');
    assert.equal(selectVisibleCreatureFields(creature, 'player').level, null);
});

test('creature reveal helper exposes player fields when reveal is precise', () => {
    const creature = buildCreatureViewModel(
        { id: 'dragon', name: 'Dragon', level: 7, unknownName: 'Scaled Terror' },
        { revealState: { name: 'precise', level: 'precise' } }
    );

    const visible = selectVisibleCreatureFields(creature, 'player');
    assert.equal(visible.name, 'Dragon');
    assert.equal(visible.level, 7);
    assert.equal(visible.nameVisible, true);
    assert.equal(visible.levelVisible, true);
});

test('bestiary entries merge static, custom, metadata, and publication visibility', () => {
    const entries = buildBestiaryCreatureEntries({
        indexItems: [{ id: 'wolf', name: 'Wolf', level: 1, traits: ['animal'] }],
        customCreatures: {
            custom_1: {
                id: 'custom_1',
                name: 'Clockwork Guard',
                data: { system: { details: { level: { value: 3 } }, traits: { value: ['construct'] } } },
            },
        },
        metadata: {
            wolf: { group: 'Forest', bestiary: false },
            custom_1: { group: 'Workshop', bestiary: true, revealState: { name: 'precise' } },
        },
        includeUnpublished: false,
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'custom_1');
    assert.equal(entries[0].group, 'Workshop');
    assert.equal(entries[0].level, 3);
    assert.equal(entries[0].revealState.name, 'precise');
});

test('bestiary catalog states collapse duplicate source rows by creature id', () => {
    const entries = buildBestiaryCreatureEntries({
        entryStates: [
            { status: 'original', baseId: 'wolf', effective: { id: 'wolf', name: 'Wolf', level: 1 } },
            { status: 'original', baseId: 'wolf', effective: { id: 'wolf', name: 'Wolf', level: 1 } },
        ],
        metadata: { wolf: { bestiary: true } },
        includeUnpublished: false,
    });

    assert.deepEqual(entries.map((entry) => entry.id), ['wolf']);
});

test('creature skill viewmodel handles numeric and object-shaped skills', () => {
    assert.deepEqual(
        buildCreatureSkillViewModel('athletics', { base: 12 }).bonus,
        12
    );

    const skill = buildCreatureSkillViewModel('stealth', {
        value: 9,
        special: [{ base: 13, label: 'in forests' }],
        notes: 'Ambush predator',
    });

    assert.equal(skill.label, 'Stealth');
    assert.equal(skill.bonus, 9);
    assert.equal(skill.specials[0].bonus, 13);
    assert.equal(skill.specials[0].label, 'in forests');
    assert.equal(skill.notes, 'Ambush predator');
});
