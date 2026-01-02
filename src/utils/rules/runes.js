
// Logic for inspecting and applying Rune effects

/**
 * Parses a weapon item to determine active runes.
 * Priority: 1. Item system data (foundry style), 2. Name parsing (legacy).
 */
export function getRunes(item) {
    const runes = {
        potency: 0,
        striking: 0,
        property: []
    };

    if (!item) return runes;

    // 1. System Data (if available/migrated)
    if (item.system?.runes) {
        runes.potency = parseInt(item.system.runes.potency) || 0;
        const striking = String(item.system.runes.striking || "").toLowerCase();
        if (striking.includes("major")) runes.striking = 3;
        else if (striking.includes("greater")) runes.striking = 2;
        else if (striking === "striking") runes.striking = 1; // "striking" or similar scalar

        // Property runes usually in array
        if (Array.isArray(item.system.runes.property)) {
            runes.property = item.system.runes.property;
        }
    } else {
        // 2. Name Parsing (Fallback)
        // e.g. "+1 Striking Longsword of Flaming"
        const name = (item.name || "").toLowerCase();

        // Potency
        if (name.includes("+3")) runes.potency = 3;
        else if (name.includes("+2")) runes.potency = 2;
        else if (name.includes("+1")) runes.potency = 1;

        // Striking
        if (name.includes("major striking")) runes.striking = 3;
        else if (name.includes("greater striking")) runes.striking = 2;
        else if (name.includes("striking")) runes.striking = 1;

        // Property Runes (Simple Check)
        const commonRunes = ["flaming", "frost", "shock", "thundering", "holy", "unholy", "returning", "shifting"];
        commonRunes.forEach(r => {
            if (name.includes(r)) runes.property.push(r);
        });
    }

    return runes;
}

/**
 * Returns damage dice multiplier from striking runes.
 * None = 1, Striking = 2, Greater = 3, Major = 4
 */
export function getStrikingDiceMultiplier(runes) {
    return 1 + (runes.striking || 0);
}

/**
 * Returns extra damage dice from property runes.
 * e.g. Flaming -> 1d6 fire
 */
export function getPropertyRuneDamage(runes) {
    const extra = [];
    (runes.property || []).forEach(r => {
        const key = String(r).toLowerCase();
        if (["flaming", "frost", "shock", "thundering"].includes(key)) {
            // These generally add 1d6 energy damage
            let type = "energy";
            if (key === 'flaming') type = 'fire';
            if (key === 'frost') type = 'cold';
            if (key === 'shock') type = 'electricity';
            if (key === 'thundering') type = 'sonic';

            extra.push({ dice: 1, die: "d6", type, label: key.charAt(0).toUpperCase() + key.slice(1) });
        }
    });
    return extra;
}
/**
 * Applies a rune to an item, returning the updated item and whether the rune was consumed.
 * @param {Object} item - The target equipment item.
 * @param {Object} rune - The rune item to apply.
 * @param {Object} options - Optional overrides
 * @param {boolean} options.isWeapon - Force treat as weapon
 * @param {boolean} options.isArmor - Force treat as armor
 * @returns {Object} { newItem: Object, consumed: boolean, error: string|null }
 */
export function applyRune(item, rune, options = {}) {
    if (!item || !rune) return { newItem: item, consumed: false, error: "Invalid item or rune." };

    // 1. Compatibility Check
    const typeLower = (item.type || "").toLowerCase();

    let isWeapon = typeLower === 'weapon' || item.group || (typeLower === 'equipment' && !item.armor && !item.shield && !typeLower.includes('armor'));
    let isArmor = typeLower === 'armor' || typeLower === 'shield' || item.armor;

    // Override if provided
    if (options.isWeapon !== undefined) isWeapon = options.isWeapon;
    if (options.isArmor !== undefined) isArmor = options.isArmor;

    // Rune categories (set by build_shop.js)
    const runeCat = rune.category;

    let targetType = null; // 'weapon' or 'armor'
    if (isWeapon && runeCat === 'rune_weapon') targetType = 'weapon';
    else if (isArmor && runeCat === 'rune_armor') targetType = 'armor';

    // Shield runes? (Usually treated as armor runes or Specific Shield runes)
    // For now, strict category match.
    if (!targetType) {
        // Fallback: Check usage or traits if category failed
        const usage = rune.system?.usage?.value || "";
        // FIX: Ensure we don't accidentally match armor runes to weapons via loose name checks
        // We require strict confirmation of the item role + loose confirmation of rune role

        const runeName = rune.name.toLowerCase();
        const runeIsWeapon = usage.includes("weapon") || runeName.includes("weapon") || runeName.includes("fanged");
        const runeIsArmor = usage.includes("armor") || usage.includes("shield") || runeName.includes("armor") || runeName.includes("resilient");

        if (isWeapon && runeIsWeapon) targetType = 'weapon';
        else if (isArmor && runeIsArmor) targetType = 'armor';
        // Relaxed rule: If explicit rune type and we are strictly one item type, assume intent?
        else if (isWeapon && !isArmor && !runeIsArmor && (rune.type === 'Rune' || runeName.includes('rune'))) {
            // Heuristic: applying a mysterious rune to a weapon. Allow it if it doesn't look like armor rune.
            targetType = 'weapon';
        }
        else if (isArmor && !isWeapon && !runeIsWeapon && (rune.type === 'Rune' || runeName.includes('rune'))) {
            targetType = 'armor';
        }
        else return { newItem: item, consumed: false, error: "Rune not compatible with this item text." };
    }

    const newItem = JSON.parse(JSON.stringify(item));
    if (!newItem.system) newItem.system = {};
    if (!newItem.system.runes) newItem.system.runes = { potency: 0, striking: "", property: [] };

    // Store original name for shop index lookup if not present
    if (!newItem.system.originalName) {
        // If we are applying a rune, the CURRENT name effectively becomes the "original" base name 
        // if it hasn't been modified yet. If it was already modified (e.g. "+1 Longsword"),
        // we ideally want "Longsword". But we can't easily guess that if it wasn't stored.
        // However, if we assume the user starts with a clean item or one that matched the shop, 
        // the current item.name IS the key.
        newItem.system.originalName = item.name;
    }

    const runeName = rune.name.toLowerCase();

    // 2. Identify Rune Effect

    // POTENCY
    if (runeName.includes("potency")) {
        let val = 0;
        if (runeName.includes("+3")) val = 3;
        else if (runeName.includes("+2")) val = 2;
        else if (runeName.includes("+1")) val = 1;

        if (val > 0) {
            // Check if upgrading
            const current = newItem.system.runes.potency || 0;
            if (val <= current) return { newItem: item, consumed: false, error: `Item already has equal or higher potency (+${current}).` };

            newItem.system.runes.potency = val;
        }
    }
    // STRIKING / RESILIENT
    else if (runeName.includes("striking") || runeName.includes("resilient")) {
        // Just store the slug or level? 
        // Logic: striking sets dice count. resilient sets save bonus (potency-like).
        // Wait, Resilient IS Armor Potency equivalent for Saves. 
        // Armor Potency adds to AC. Resilient adds to Saves.

        // Let's stick to the "Striking" field for weapons.
        // For Armor, "Resilient" is a property rune? No, it's fundamental.
        // PF2e data model: armor.runes.resilient (number).

        if (targetType === 'weapon' && runeName.includes("striking")) {
            let val = ""; // "striking", "greaterStriking", "majorStriking"
            let level = 1;

            if (runeName.includes("major")) { val = "majorStriking"; level = 3; }
            else if (runeName.includes("greater")) { val = "greaterStriking"; level = 2; }
            else { val = "striking"; level = 1; }

            // Compare
            const currentStr = newItem.system.runes.striking || "";
            let currentLvl = 0;
            if (currentStr.includes("major")) currentLvl = 3;
            else if (currentStr.includes("greater")) currentLvl = 2;
            else if (currentStr === "striking") currentLvl = 1;

            if (level <= currentLvl) return { newItem: item, consumed: false, error: `Item already has equal or better striking rune.` };

            newItem.system.runes.striking = val;
        }
        else if (targetType === 'armor' && runeName.includes("resilient")) {
            let val = 0;
            if (runeName.includes("major")) val = 3;
            else if (runeName.includes("greater")) val = 2;
            else val = 1;

            const current = newItem.system.runes.resilient || 0;
            if (val <= current) return { newItem: item, consumed: false, error: `Item already has equal or better resilient rune.` };

            newItem.system.runes.resilient = val;
        }
    }
    // PROPERTY RUNES
    else {
        // Assume property rune
        // Limit check? (potency usually dictates limit 1-3).
        const limit = newItem.system.runes.potency || 0;
        // Note: explorers clothing starts at 0 but can hold runes. 
        // Rule: property runes <= potency. Or specific items.

        // Let's enforce limit if it's a weapon/armor.
        // But let's be generous for now or prompt warning?
        // Implementing strict limit:
        const currentProps = newItem.system.runes.property || [];
        if (currentProps.length >= limit) { // Potency +1 = 1 prop.
            // Special case: specific items might differ, but general rule holds.
            // If pot is 0, limit is 0? 
            // Exception: +0 items can't hold property runes usually.
            if (limit === 0) return { newItem: item, consumed: false, error: "Item needs Potency rune (+1 or higher) to hold property runes." };
            return { newItem: item, consumed: false, error: `Rune limit reached (${limit}). Upgrade potency first.` };
        }

        // Extract slug from name or use name
        // Cleaning name: "Flaming (Greater)" -> "flaming" ?
        // Just use the name for display/logic for now.
        // Check duplicate
        if (currentProps.some(p => p.toLowerCase() === rune.name.toLowerCase())) {
            return { newItem: item, consumed: false, error: "Rune already applied." };
        }

        // Push full name or slug? "Flaming"
        currentProps.push(rune.name);
        newItem.system.runes.property = currentProps;
    }

    // 3. Update Name
    newItem.name = reconstructItemName(newItem);

    return { newItem, consumed: true, error: null };
}

/**
 * Removes a rune from an item.
 * @param {Object} item 
 * @param {string} runeType - 'potency', 'striking', 'resilient', or property name
 * @param {string|null} propertyName - Specific property rune to remove
 */
export function removeRune(item, runeType, propertyName = null) {
    if (!item || !item.system?.runes) return { newItem: item, runeRecovered: null };

    const newItem = JSON.parse(JSON.stringify(item));
    let recoveredName = null;

    const typeLower = (item.type || "").toLowerCase();
    const isArmor = typeLower === 'armor' || typeLower === 'shield' || item.armor;
    const targetType = isArmor ? 'armor' : 'weapon'; // Simplify default to weapon if not armor

    if (runeType === 'potency') {
        const val = newItem.system.runes.potency;
        if (val > 0) {
            newItem.system.runes.potency = 0;
            const label = val === 3 ? "+3" : val === 2 ? "+2" : "+1";

            // Recovered item name roughly
            recoveredName = targetType === 'armor' ? `Armor Potency (${label})` : `Weapon Potency (${label})`;
            if (targetType === 'weapon') recoveredName = `Weapon Potency (${label})`;
            // We need to know if it's armor/weapon to name the recovered rune correctly?
            // Heuristic:
            const isArmor = item.type === 'Armor';
            recoveredName = isArmor ? `Armor Potency (${label})` : `Weapon Potency (${label})`;

            // If we remove potency, we must enforce property limit?
            // Technically yes, properties go dormant or fall off. 
            // For sim, let's just clear potency.
        }
    } else if (runeType === 'striking') {
        const val = newItem.system.runes.striking;
        if (val) {
            newItem.system.runes.striking = "";
            if (val.includes("major")) recoveredName = "Major Striking Rune";
            else if (val.includes("greater")) recoveredName = "Greater Striking Rune";
            else recoveredName = "Striking Rune";
        }
    } else if (runeType === 'resilient') {
        const val = newItem.system.runes.resilient;
        if (val) {
            newItem.system.runes.resilient = 0;
            if (val === 3) recoveredName = "Major Resilient Rune";
            else if (val === 2) recoveredName = "Greater Resilient Rune";
            else recoveredName = "Resilient Rune";
        }
    } else if (runeType === 'property' && propertyName) {
        const idx = (newItem.system.runes.property || []).findIndex(p => p === propertyName);
        if (idx > -1) {
            newItem.system.runes.property.splice(idx, 1);
            recoveredName = propertyName + " Rune";
            // This is a guess. "Flaming" -> "Flaming Rune"? 
            // Ideally we'd look up the original item, but we don't have it.
            // "Flaming" usually maps to a "Flaming Rune" item.
        }
    }

    newItem.name = reconstructItemName(newItem);

    return { newItem, runeRecovered: recoveredName ? { name: recoveredName, type: 'Rune', category: 'rune_weapon' } : null };
    // Note: category is hardcoded guess, user needs to rely on name matching or we refine this.
}

function reconstructItemName(item) {
    let baseName = item.name;

    // 1. Strip existing prefixes/suffixes roughly
    // Regex for +1, +2, +3
    baseName = baseName.replace(/^\+[1-3]\s+/, '');
    // Regex for Striking
    baseName = baseName.replace(/\s+(Major|Greater)?\s*Striking\s+/i, ' ');
    // Regex for Resilient
    baseName = baseName.replace(/\s+(Major|Greater)?\s*Resilient\s+/i, ' ');
    // Regex for known property runes? Hard to do perfectly without a list.
    // Instead of stripping, maybe we assume the user's item name WAS correct and we regenerate the "Magical Header" parts?

    // Better approach: 
    // If name is "+1 Striking Longsword", we want "Longsword".
    // "Flaming Longsword" -> "Longsword"?

    // Let's try to detect the "Base Item Name" if possible.
    // If we can't clean it perfectly, we might double up.
    // Heuristic: Most items are "Longsword" or "Composite Longbow".
    // We can just rely on the fact that we are ADDING modifiers.

    // Current Strategy: 
    // 1. Remove "+X" from start.
    // 2. Remove "Striking/Resilient" words.
    // 3. Trim.
    // 4. Rebuild.

    let temp = baseName;
    temp = temp.replace(/^\+[1-3]\s+/, '');
    temp = temp.replace(/\b(Major|Greater|Lesser)?\s*Striking\b/gi, '');
    temp = temp.replace(/\b(Major|Greater|Lesser)?\s*Resilient\b/gi, '');
    temp = temp.replace(/\s+/g, ' ').trim();

    // Rebuild
    const r = item.system.runes || {};
    let prefix = "";
    if (r.potency) prefix += `+${r.potency} `;

    let mid = "";
    if (r.striking) {
        if (r.striking.includes("major")) mid += "Major Striking ";
        else if (r.striking.includes("greater")) mid += "Greater Striking ";
        else mid += "Striking ";
    }
    if (r.resilient) {
        if (r.resilient === 3) mid += "Major Resilient ";
        else if (r.resilient === 2) mid += "Greater Resilient ";
        else mid += "Resilient ";
    }

    // Properties? usually just listed or "Flaming Longsword"
    // If we have properties, maybe we don't auto-add them to name to avoid clutter, 
    // or just add them if it's a single one?
    // Let's stick to Fundamental runes for the name for now, as properties can get long.

    return `${prefix}${mid}${temp}`.replace(/\s+/g, ' ').trim();
}
