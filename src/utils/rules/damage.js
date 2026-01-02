
import { getRunes, getStrikingDiceMultiplier, getPropertyRuneDamage } from './runes';
import { getFeatDamageModifiers } from './feats';
import { getWeaponAttackBonus } from '../../shared/utils/combatUtils'; // For proficiency rank

/**
 * Calculates the full damage profile for a weapon.
 * @param {object} weapon - The weapon item
 * @param {object} character - The character object
 * @returns {object} Full damage data (normal, crit, breakdown)
 */
export function calculateWeaponDamage(weapon, character) {
    if (!weapon || !character) return null;

    // 1. Base Stats
    const runes = getRunes(weapon);
    const strikingMult = getStrikingDiceMultiplier(runes); // 1, 2, 3...

    // Parse Dice: "1d8" -> count:1, die:"d8", type:"slashing"
    let baseDamageStr = weapon.damage?.die || weapon.damage?.dice || weapon.system?.damage?.die || "";
    let baseCount = 1;
    let baseDie = "d4"; // Fallback
    let damageType = (weapon.damage?.damageType || weapon.system?.damage?.damageType || "physical").toLowerCase();

    // Fix for Bombs/Flat Damage: If dice is set but die is empty, treating as flat damage?
    // Check regex for "1d8", "d8", "1"
    const diceMatch = String(baseDamageStr).match(/(\d*)d(\d+)/i);
    if (diceMatch) {
        baseCount = parseInt(diceMatch[1]) || 1;
        baseDie = `d${diceMatch[2]}`;
    } else if (parseInt(baseDamageStr) && !String(baseDamageStr).includes('d')) {
        // Flat damage case (e.g. Acid Flask)
        baseCount = parseInt(baseDamageStr);
        baseDie = "";
    } else if (baseDamageStr) {
        baseDie = baseDamageStr;
    }

    // Striking sets the number of weapon dice
    // Only apply striking if we have a dice size (don't multiply flat damage)
    const finalDiceCount = baseDie ? Math.max(baseCount, strikingMult) : baseCount;

    // 2. Modifiers (Str/Dex)
    let attrMod = 0;
    const str = parseInt(character.stats?.attributes?.strength) || 0;
    const traits = (weapon.traits?.value || weapon.traits || []).map(t => String(t).toLowerCase());

    const isRanged = /ranged|firearm|crossbow|bow|bomb/.test(weapon.group || '') || traits.includes('thrown');
    const isPropulsive = traits.includes('propulsive');
    const isThrown = traits.includes('thrown');

    if (!isRanged) {
        attrMod = str;
    } else if (isThrown) {
        attrMod = str;
    } else if (isPropulsive) {
        attrMod = Math.ceil(str / 2);
    }
    if (str < 0 && (isPropulsive || isThrown || weapon.group === 'bow')) {
        attrMod = str;
    }

    // 3. Feats & Bonuses
    const { breakdown: attackBreakdown } = getWeaponAttackBonus(weapon, character);
    const profRank = attackBreakdown?.proficiency || 0;

    const featMods = getFeatDamageModifiers(character, weapon, profRank);
    const featTotal = featMods.reduce((sum, mod) => sum + (mod.value || 0), 0);
    const featDice = featMods.filter(mod => mod.dice);

    // 4. Property Runes
    const propertyDice = getPropertyRuneDamage(runes);

    const allExtraDice = [...propertyDice, ...featDice];

    // NEW: Special Damage (Splash, Persistent)
    const specialDamage = [];

    // Splash - Check both system.splashDamage and root splashDamage for compatibility
    const splashVal = weapon.system?.splashDamage?.value || weapon.splashDamage?.value;
    if (splashVal && splashVal > 0) {
        specialDamage.push({ value: splashVal, type: damageType, label: 'Splash', style: 'splash' });
    }

    // Persistent - Check both system.damage.persistent, root persistent, AND flat damage.persistent
    // Some formats flatten 'damage' to root, others keep 'system.damage'
    const persistent = weapon.system?.damage?.persistent || weapon.persistent || weapon.damage?.persistent;
    if (persistent && persistent.number) { // e.g. { number: 1, faces: 6, type: 'acid' }
        specialDamage.push({
            dice: persistent.number,
            die: persistent.faces ? `d${persistent.faces}` : '',
            type: persistent.type || damageType,
            label: 'Persistent',
            style: 'persistent'
        });
    }

    // 5. Build Normal Damage Object
    const flatBonus = attrMod + featTotal;
    const normalDamage = {
        dice: finalDiceCount,
        die: baseDie,
        type: damageType,
        modifier: flatBonus,
        breakdown: {
            dice: baseDie ? `${finalDiceCount}${baseDie}` : `${finalDiceCount}`,
            attribute: attrMod,
            feats: featMods.length > 0 ? featMods : null,
        },
        extraDice: allExtraDice,
        special: specialDamage
    };

    // 6. Critical Logic
    let critDie = baseDie;
    let fatalDieObj = null;
    const fatalTrait = traits.find(t => t.startsWith('fatal'));
    if (fatalTrait && baseDie) {
        const match = fatalTrait.match(/d(\d+)/);
        if (match) {
            critDie = `d${match[1]}`;
            fatalDieObj = { count: 1, die: critDie, label: 'Fatal' };
        }
    }

    let deadlyDieObj = null;
    const deadlyTrait = traits.find(t => t.startsWith('deadly'));
    if (deadlyTrait) {
        const match = deadlyTrait.match(/d(\d+)/);
        if (match) {
            let deadlyCount = 1;
            if (strikingMult === 3) deadlyCount = 2;
            if (strikingMult === 4) deadlyCount = 3;
            deadlyDieObj = { count: deadlyCount, die: `d${match[1]}`, label: 'Deadly' };
        }
    }

    const critDamage = {
        base: {
            dice: finalDiceCount,
            die: critDie,
            modifier: flatBonus,
            type: damageType
        },
        doubledExtras: [...allExtraDice], // Start with standard extras
        critExtras: [],
        special: [] // Will contain non-doubled specials (like Splash)
    };

    // Split special damage: Persistent goes to doubledExtras, Splash goes to special
    specialDamage.forEach(sp => {
        if (sp.style === 'persistent') {
            critDamage.doubledExtras.push(sp);
        } else {
            critDamage.special.push(sp);
        }
    });

    if (fatalDieObj) critDamage.critExtras.push(fatalDieObj);
    if (deadlyDieObj) critDamage.critExtras.push(deadlyDieObj);

    // Format Helper
    const formatType = (t) => {
        const lower = String(t).toLowerCase();
        if (lower === 'piercing') return '(P)';
        if (lower === 'slashing') return '(S)';
        if (lower === 'bludgeoning') return '(B)';
        return lower; // e.g. 'fire' -> 'fire'
    };

    const formatLabel = (l) => {
        const lower = String(l || '').toLowerCase();
        if (lower === 'splash') return 'Spl.';
        if (lower === 'persistent') return 'Pers.';
        if (lower === 'precision') return 'Prec.';
        return l;
    };

    const formatDamageParts = (d, isCritStructure = false) => {
        let parts = [];

        // Base
        const main = isCritStructure ? d.base : d;
        const dicePart = main.die ? `${main.dice}${main.die}` : `${main.dice}`;

        let modStr = "";
        if (main.modifier > 0) modStr = `+ ${main.modifier}`;
        else if (main.modifier < 0) modStr = `- ${Math.abs(main.modifier)}`;

        let baseText = `${dicePart}`;
        if (modStr) baseText += ` ${modStr}`;
        baseText += ` ${formatType(main.type)}`;

        if (isCritStructure) {
            // CRIT: 2 * (Base ... + Extras ...) + CritExtras ...
            // We want to colorize "Extras" inside the parentheses if they have styles

            parts.push({ text: `2 * (`, style: 'crit-base' });
            parts.push({ text: baseText, style: 'crit-base' }); // Base matches crit-base color usually

            d.doubledExtras.forEach(ex => {
                // Bundle separator with the style of the extra part
                parts.push({
                    text: ` + ${ex.dice}${ex.die} ${formatLabel(ex.label || ex.type)}`,
                    style: ex.style || 'crit-base', // Preserve Purple etc
                    type: ex.type
                });
            });

            parts.push({ text: `)`, style: 'crit-base' });

            // Undoubled Extras
            d.critExtras.forEach(ex => {
                parts.push({ text: ` + ${ex.count}${ex.die} ${formatLabel(ex.label)}`, style: 'crit-extra' });
            });

        } else {
            // Normal
            parts.push({ text: baseText, style: 'base' });

            d.extraDice.forEach(ex => {
                parts.push({
                    text: `+ ${ex.dice}${ex.die} ${formatLabel(ex.label || ex.type)}`,
                    style: ex.style || 'extra',
                    type: ex.type
                });
            });
        }

        // Special Damage (Splash, Persistent) - Appended to both
        // For Crit, d.special ONLY contains undoubled stuff (Splash). Persistent is up in doubledExtras.
        if (d.special && d.special.length > 0) {
            d.special.forEach(sp => {
                const spText = sp.value ? `${sp.value}` : `${sp.dice}${sp.die}`;
                parts.push({
                    text: ` + ${spText} ${formatLabel(sp.label)} ${formatType(sp.type)}`, // e.g. + 1 Spl. acid
                    style: sp.style || 'special'
                });
            });
        }

        return parts;
    };

    const formatToString = (parts) => {
        return parts.map(p => p.text).join(' ');
    };

    const normalParts = formatDamageParts(normalDamage, false);
    const critParts = formatDamageParts(critDamage, true);

    return {
        normal: { ...normalDamage, parts: normalParts, text: formatToString(normalParts) },
        crit: { ...critDamage, parts: critParts, text: formatToString(critParts) }
    };
}
