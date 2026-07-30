import { actorHasMagic } from '../shared/actors/actorCapabilities.js';
import { clampAwakeningLevel } from '../shared/pacts/pactState.js';
import { resolveEffectModifiersForSelectors } from '../shared/rules/effectResolver.js';
import { calculateSpellAttackAndDC } from '../utils/rules.js';

export const BACKLASH_RULES = Object.freeze([
    "Whenever you attempt to use a deviation, roll a DC 5 flat check. On a success, you use your deviation and the DC for subsequent checks increases by 5, to a maximum of 20; on a failure, you use your deviation and then suffer a backlash effect, after which your flat check DC resets to 5. Backlash progresses from mild, to moderate, to severe. When you have already taken mild backlash in a given day, the next time you would take backlash, you take the moderate backlash instead, and if you have already taken moderate backlash, you take the severe backlash instead, and your deviation can't be used for the rest of the day - attempting to use it simply brings pain. When you make your daily preparations, your flat check DC returns to 5 and your next backlash returns to mild.",
    "Any effects from backlash can't be reduced, prevented, or otherwise bypassed. Conditions and damage you take from backlash can't be reduced or prevented by resistance or immunity, but still triggers any weakness you have to it.",
]);

export const DEVIATION_RULES = "Many deviations allow for a saving throw or have other abilities that change as you go up in level. The DC for any saving throw called for by a deviation is the higher of your class DC or spell DC. The attack modifier of a deviation is 10 lower than that DC, unless the deviation calls for a Strike, in which case the attack modifier is the highest between the spell DC - 10, the class DC - 10, or the normal attack modifier of the Strike. A deviation's counteract modifier is equal to the deviation's DC - 10.";

export function calculateDeviationStatistics(character) {
    const actorEffects = Array.isArray(character?.actorEffects)
        ? character.actorEffects
        : Array.isArray(character?.effects)
            ? character.effects
            : [];
    const classDcEffects = resolveEffectModifiersForSelectors(actorEffects, ['class.dc', 'all.dcs']);
    const baseClassDc = finiteNumber(character?.stats?.class_dc, 10);
    const classDc = baseClassDc + classDcEffects.total;
    const spellDc = actorHasMagic(character)
        ? finiteNumber(calculateSpellAttackAndDC(character).dc?.total, 10)
        : null;
    const dc = Math.max(classDc, spellDc ?? Number.NEGATIVE_INFINITY);

    return {
        dc,
        attack: dc - 10,
        counteract: dc - 10,
        classDc,
        spellDc,
        source: spellDc != null && spellDc > classDc ? 'spell' : 'class',
    };
}

export function selectLearnedDeviantAbilities({ pact, pactState, resolveAbility } = {}) {
    if (!pact || typeof resolveAbility !== 'function') return [];

    return (pact.abilityGroups || []).flatMap((group, groupIndex) => {
        const abilityId = pactState?.choices?.[groupIndex];
        const ability = abilityId ? resolveAbility(abilityId) : null;
        if (!ability) return [];
        return [{
            ability,
            group,
            groupIndex,
            unlockedAwakeningLevel: clampAwakeningLevel(pactState?.unlockedAwakenings?.[ability.id]),
        }];
    });
}

function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
