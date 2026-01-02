import { getShopIndexItemByName } from '../catalog/shopIndex';

/**
 * Calculates the ammunition capacity of a weapon based on its traits.
 * @param {object} item - The weapon item.
 * @returns {number} - The capacity (default 1).
 */
export const getWeaponCapacity = (item) => {
    // 1. Ensure we have traits. If not on item, check shop index.
    let traitsRaw = item.traits;
    if (!traitsRaw) {
        let fromIndex = item.name ? getShopIndexItemByName(item.name) : null;
        if (!fromIndex && item.system?.originalName) {
            fromIndex = getShopIndexItemByName(item.system.originalName);
        }
        if (fromIndex && fromIndex.traits) {
            traitsRaw = fromIndex.traits;
        }
    }

    // 2. Normalize traits to array of lowercase strings
    let traits = [];
    if (Array.isArray(traitsRaw?.value)) {
        traits = traitsRaw.value.map(t => String(t).toLowerCase());
    } else if (Array.isArray(traitsRaw)) {
        traits = traitsRaw.map(t => String(t).toLowerCase());
    } else if (typeof traitsRaw === 'string') {
        traits = traitsRaw.split(',').map(t => t.trim().toLowerCase());
    }

    // 3. Check for specific capacity traits
    if (traits.includes('repeating')) return 5;
    if (traits.includes('double-barrel')) return 2;
    if (traits.includes('triple-barrel') || traits.includes('triple barrel')) return 3;

    // 4. Regex for Capacity-X (handles "Capacity-3", "Capacity 3", etc.)
    // Iterate to find the matching string
    for (const t of traits) {
        // Match "capacity" followed by non-digit separator (optional) then digit(s)
        const match = t.match(/^capacity[\s-]?(\d+)$/);
        if (match) {
            const val = parseInt(match[1], 10);
            return isNaN(val) ? 1 : val;
        }
    }

    return 1;
};

/**
 * Calculates the attack bonus for a weapon for a given character.
 * @param {object} item - The weapon item.
 * @param {object} character - The character object (required for stats/level).
 * @returns {object} - Object containing total bonus, breakdown, and source details.
 */
export const getWeaponAttackBonus = (item, character) => {
    if (!character || !item) return { total: 0, breakdown: {}, source: {} };

    const grp = (item.group || '').toLowerCase();
    const cat = (item.category || '').toLowerCase(); // Simple, Martial, Advanced
    const traits = (item.traits?.value || []);

    // 1. Proficiency Rank (0=Untrained, 2=Trained, 4=Expert, 6=Master, 8=Legendary)
    // Check Group Score (e.g. "Firearms") vs Category Score (e.g. "Martial")
    let profScore = 0;

    // Map raw strings to DB keys if needed, assuming direct mapping for now based on new_db.json
    // DB keys: "Unarmored", "Light", "Medium", "Heavy", "Firearms", "Crossbows", "Bombs"
    // Also "Simple", "Martial", "Advanced", "Unarmed" might exist in full schema or inferred.
    const profs = character.proficiencies || {};

    const getScore = (key) => {
        if (!key) return 0;
        // Try exact match, then Capitalized
        const exact = profs[key];
        if (exact !== undefined) return parseInt(exact) || 0;

        const cap = key.charAt(0).toUpperCase() + key.slice(1);
        return parseInt(profs[cap]) || 0;
    };

    // Specific Group Priority
    let groupScore = 0;
    if (grp === 'firearm') groupScore = getScore("Firearms");
    else if (grp === 'crossbow') groupScore = getScore("Crossbows");
    else if (grp === 'bomb') groupScore = getScore("Bombs");
    else if (grp === 'sword') groupScore = getScore("Swords"); // Speculative
    else if (grp === 'bow') groupScore = getScore("Bows"); // Speculative

    // Category Priority
    let catScore = 0;
    if (cat === 'simple') catScore = getScore("Simple");
    else if (cat === 'martial') catScore = getScore("Martial");
    else if (cat === 'advanced') catScore = getScore("Advanced");
    else if (cat === 'unarmed') catScore = getScore("Unarmed");

    profScore = Math.max(groupScore, catScore);

    // 2. Attribute
    // Ranged (Firearm, Bow, Crossbow, Bomb) -> DEX
    // Melee + Finesse -> Max(STR, DEX)
    // Melee -> STR
    // Thrown -> DEX (Attack), STR (Damage). Attack is DEX.

    let attrMod = 0;
    const str = parseInt(character.stats?.attributes?.strength) || 0;
    const dex = parseInt(character.stats?.attributes?.dexterity) || 0;

    const isRanged = /ranged|firearm|crossbow|bow|bomb/.test(grp) || traits.includes('thrown');
    const isFinesse = traits.includes('finesse');

    if (isRanged) {
        attrMod = dex;
    } else if (isFinesse) {
        attrMod = Math.max(str, dex);
    } else {
        attrMod = str;
    }

    // 3. Level (If Trained+)
    const level = (profScore > 0) ? (parseInt(character.level) || 0) : 0;

    // 4. Item Bonus (Potency Runes)
    let itemBonus = 0;
    if (item.system?.runes?.potency) itemBonus = parseInt(item.system.runes.potency) || 0;
    else if (item.bonus) itemBonus = parseInt(item.bonus) || 0; // Fallback
    else if (item.name.includes('+1')) itemBonus = 1;
    else if (item.name.includes('+2')) itemBonus = 2;
    else if (item.name.includes('+3')) itemBonus = 3;

    return {
        total: profScore + level + attrMod + itemBonus,
        breakdown: {
            proficiency: profScore,
            level: level,
            attribute: attrMod,
            item: itemBonus
        },
        source: {
            profRaw: profScore,
            profName: profScore === 2 ? 'Trained' : profScore === 4 ? 'Expert' : profScore === 6 ? 'Master' : profScore === 8 ? 'Legendary' : 'Untrained',
            attrName: isRanged ? 'Dex' : isFinesse && dex > str ? 'Dex (Finesse)' : 'Str',
            levelVal: character.level
        }
    };
};

/**
 * Determines the category bucket for an inventory item (Equipment, Consumables, Misc).
 * @param {object} item - The inventory item.
 * @returns {string} - 'equipment', 'consumables', or 'misc'.
 */
export const getInventoryBucket = (item) => {
    let fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
    if (!fromIndex && item.system?.originalName) {
        fromIndex = getShopIndexItemByName(item.system.originalName);
    }

    const type = String(item?.type || fromIndex?.type || '').toLowerCase();
    const category = String(item?.category || fromIndex?.category || '').toLowerCase();

    if (['armor', 'shield', 'weapon'].includes(type)) return 'equipment';
    if (type === 'ammo') return 'consumables';
    if (['potion', 'poison', 'mutagen', 'ammo', 'gadget'].includes(category)) return 'consumables';
    return 'misc';
};

/**
 * Checks if an item is equipable (Armor, Shield, Weapon).
 * @param {object} item - The inventory item.
 * @returns {boolean} - True if equipable.
 */
export const isEquipableInventoryItem = (item) => {
    let fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
    if (!fromIndex && item.system?.originalName) {
        fromIndex = getShopIndexItemByName(item.system.originalName);
    }
    const type = String(item?.type || fromIndex?.type || '').toLowerCase();
    return ['armor', 'shield', 'weapon'].includes(type);
};
