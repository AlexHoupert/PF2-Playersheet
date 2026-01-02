
// Logic for applying Feat effects to damage

/**
 * Calculates damage modifiers from feats.
 * @param {object} character 
 * @param {object} weapon 
 * @param {number} profRank - 0=Untrained... 8=Legendary
 * @returns {Array} List of modifiers, each { value, label } or { dice, die, type, label }
 */
export function getFeatDamageModifiers(character, weapon, profRank) {
    const mods = [];
    const feats = character.feats || []; // Assuming generic feats list

    // Check both feats array and class features
    // Check both feats array and class features
    const hasFeat = (targetName) => {
        const checkList = (list) => {
            if (!Array.isArray(list)) return false;
            return list.some(item => {
                const itemName = (typeof item === 'string') ? item : item?.name;
                return String(itemName || '').toLowerCase() === targetName.toLowerCase();
            });
        };
        return checkList(feats) || checkList(character.classFeatures);
    };

    // 1. Weapon Specialization
    const hasWeaponSpec = hasFeat("Weapon Specialization");
    const hasGreaterSpec = hasFeat("Greater Weapon Specialization");

    if (hasWeaponSpec || hasGreaterSpec) {
        let bonus = 0;
        if (profRank >= 8) bonus = hasGreaterSpec ? 8 : 4;       // Legendary
        else if (profRank >= 6) bonus = hasGreaterSpec ? 6 : 3;  // Master
        else if (profRank >= 4) bonus = hasGreaterSpec ? 4 : 2;  // Expert

        if (bonus > 0) {
            mods.push({ value: bonus, label: "Weapon Specialization" });
        }
    }

    // 2. Slinger's Precision (Gunslinger)
    // "Extra +2 precision (cross) / 1d4 precision (firearm)." (Level 1+)
    // "Gunslinging Legend (Level 13+): +3 precision (cross) / 1d6 precision (firearm)."
    // Condition: Non-repeating.
    // Weapons: Crossbows or Firearms.

    const hasSlingers = hasFeat("Slinger's Precision");
    // Usually a class feature for Way of the Sniper? Or base Gunslinger?
    // User says: "We start with Slinger's Precision". 
    // We assume the character HAS the feat if we are to apply it.

    if (hasSlingers) {
        const traits = (weapon.traits?.value || weapon.traits || []).map(t => String(t).toLowerCase());
        const group = (weapon.group || '').toLowerCase();

        // Exclude repeating
        if (!traits.includes('repeating')) {
            const level = parseInt(character.level) || 1;
            const isLegend = level >= 13; // "Gunslinging Legend" at lvl 13

            const isFirearm = group === 'firearm' || traits.includes('firearm') || /pistol|musket|arquebus|blunderbuss/i.test(weapon.name);
            const isCrossbow = group === 'crossbow' || traits.includes('crossbow') || /crossbow/i.test(weapon.name);

            if (isFirearm) {
                // Firearm: 1d4 (1-12) or 1d6 (13+)
                mods.push({
                    dice: 1,
                    die: isLegend ? 'd6' : 'd4',
                    type: 'precision',
                    label: "Precision"
                });
            } else if (isCrossbow) {
                // Crossbow: +2 (1-12) or +3 (13+)
                mods.push({
                    value: isLegend ? 3 : 2,
                    label: "Precision"
                });
            }
        }
    }


    // 3. Sneak Attack (Rogue)
    // "1d6 precision. +1d6 at 5, 11, 17."
    // Traits: Agile or Finesse for Melee/Thrown. Ranged weapons OK.
    const hasSneak = hasFeat("Sneak Attack");
    if (hasSneak) {
        // Validation
        const traits = (weapon.traits?.value || weapon.traits || []).map(t => String(t).toLowerCase());
        const group = (weapon.group || '').toLowerCase();

        const isAgile = traits.includes('agile');
        const isFinesse = traits.includes('finesse');
        const isThrown = traits.includes('thrown');
        const isRanged = /ranged|firearm|crossbow|bow|bomb/.test(group) || traits.includes('ranged');
        // Note: 'thrown' is functionally ranged for attack, but rule says "For a ranged attack with a thrown melee weapon..."

        let valid = false;

        if (isThrown) {
            // "For a ranged attack with a thrown melee weapon, that weapon must also be agile or finesse."
            if (isAgile || isFinesse) valid = true;
        } else if (isRanged) {
            // Pure ranged weapon -> OK
            valid = true;
        } else {
            // Melee -> Agile or Finesse
            if (isAgile || isFinesse) valid = true;
        }

        if (valid) {
            const level = parseInt(character.level) || 1;
            let diceCount = 1;
            if (level >= 17) diceCount = 4;
            else if (level >= 11) diceCount = 3;
            else if (level >= 5) diceCount = 2;

            mods.push({
                dice: diceCount,
                die: 'd6',
                type: 'precision',
                label: "Sneak Attack",
                style: 'purple' // UI hint
            });
        }
    }

    return mods;
}
