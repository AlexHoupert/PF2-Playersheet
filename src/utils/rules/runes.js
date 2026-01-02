
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
