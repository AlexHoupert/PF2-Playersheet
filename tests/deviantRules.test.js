import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateDeviationStatistics,
    selectLearnedDeviantAbilities,
} from '../src/pacts/deviantRules.js';
import { countUnlockedAwakeningPoints } from '../src/shared/pacts/pactState.js';

test('deviation statistics use the higher of class DC and spell DC', () => {
    const classBased = calculateDeviationStatistics({
        level: 5,
        stats: { class_dc: 21, attributes: { intelligence: 4 } },
        magic: { proficiency: 0, list: [], slots: {} },
    });
    assert.deepEqual(classBased, {
        dc: 21,
        attack: 11,
        counteract: 11,
        classDc: 21,
        spellDc: null,
        source: 'class',
    });

    const spellBased = calculateDeviationStatistics({
        level: 5,
        isCaster: true,
        stats: { class_dc: 19, attributes: { intelligence: 4 } },
        magic: { attribute: 'Intelligence', proficiency: 4, list: [], slots: {} },
    });
    assert.equal(spellBased.classDc, 19);
    assert.equal(spellBased.spellDc, 23);
    assert.equal(spellBased.dc, 23);
    assert.equal(spellBased.attack, 13);
    assert.equal(spellBased.counteract, 13);
    assert.equal(spellBased.source, 'spell');
});

test('deviation statistics include active DC effects', () => {
    const result = calculateDeviationStatistics({
        level: 5,
        stats: { class_dc: 21, attributes: {} },
        actorEffects: [{
            id: 'frightened',
            modifiers: [{
                id: 'frightened-dcs',
                selector: 'all.dcs',
                mode: 'penalty',
                bonusType: 'status',
                value: -1,
            }],
        }],
    });

    assert.equal(result.classDc, 20);
    assert.equal(result.dc, 20);
    assert.equal(result.attack, 10);
    assert.equal(result.counteract, 10);
});

test('learned Deviant Abilities come only from pact choices and preserve group context', () => {
    const abilities = {
        spark: { id: 'spark', name: 'Spark' },
        storm: { id: 'storm', name: 'Storm' },
    };
    const learned = selectLearnedDeviantAbilities({
        pact: {
            abilityGroups: [
                { label: 'Initial', abilityIds: ['spark'] },
                { label: 'Level 6', abilityIds: ['storm'] },
            ],
        },
        pactState: {
            choices: { 0: 'spark' },
            unlockedAwakenings: { spark: 1 },
        },
        resolveAbility: (id) => abilities[id],
    });

    assert.equal(learned.length, 1);
    assert.equal(learned[0].ability.id, 'spark');
    assert.equal(learned[0].group.label, 'Initial');
    assert.equal(learned[0].unlockedAwakeningLevel, 1);
});

test('awakening reset refunds the number of unlocked awakening tiers', () => {
    assert.equal(countUnlockedAwakeningPoints({ spark: 1, storm: 2, invalid: 9 }), 5);
    assert.equal(countUnlockedAwakeningPoints({}), 0);
});
