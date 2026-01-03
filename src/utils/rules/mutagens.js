
// Helper to calculate bonus based on Item Level (standard progression)
// Standard: Lvl 1 (+1), Lvl 3 (+2), Lvl 11 (+3), Lvl 17 (+4)
const getStandardBonus = (level) => {
    if (level >= 17) return 4;
    if (level >= 11) return 3;
    if (level >= 3) return 2;
    return 1;
};

// Data Definition
export const MUTAGEN_DATA = {
    "Bestial Mutagen": {
        bonuses: (level) => [
            { stat: "Athletics", type: "item", value: getStandardBonus(level) },
            { stat: "Unarmed Attack", type: "item", value: getStandardBonus(level) }
        ],
        penalties: (level) => [
            { stat: "AC", type: "item", value: -1 },
            { stat: "Reflex", type: "item", value: -2 }
        ]
    },
    "Quicksilver Mutagen": {
        bonuses: (level) => [
            { stat: "Acrobatics", type: "item", value: getStandardBonus(level) },
            { stat: "Stealth", type: "item", value: getStandardBonus(level) },
            { stat: "Thievery", type: "item", value: getStandardBonus(level) },
            { stat: "Reflex", type: "item", value: getStandardBonus(level) },
            { stat: "Ranged Attack", type: "item", value: getStandardBonus(level) },
            { stat: "Dexterity Actions", type: "item", value: getStandardBonus(level) } // Catch-all for Dex attacks? logic needed
        ],
        penalties: (level) => [
            { stat: "HP", type: "untyped", value: -(level * 2) } // Just a rough penalty placeholder for damage taken
        ]
    },
    "Juggernaut Mutagen": {
        bonuses: (level) => [
            { stat: "Fortitude", type: "item", value: getStandardBonus(level) },
            // Temp HP is handled on consume, not as a continuous stat mod usually, but we can track it?
            // Actually Juggernaut gives Temp HP. We'll handle that in consume logic.
        ],
        penalties: (level) => [
            { stat: "Will", type: "item", value: -2 },
            { stat: "Perception", type: "item", value: -2 },
            { stat: "Initiative", type: "item", value: -2 }
        ]
    },
    "Serene Mutagen": {
        bonuses: (level) => [
            { stat: "Will", type: "item", value: getStandardBonus(level) },
            { stat: "Medicine", type: "item", value: getStandardBonus(level) },
            { stat: "Nature", type: "item", value: getStandardBonus(level) },
            { stat: "Religion", type: "item", value: getStandardBonus(level) },
            { stat: "Survival", type: "item", value: getStandardBonus(level) }
        ],
        penalties: (level) => [
            { stat: "Attack", type: "item", value: -1 },
            { stat: "Damage", type: "item", value: -1 } // Spell damage too? Usually "all damage"
        ]
    },
    "Silvertongue Mutagen": {
        bonuses: (level) => [
            { stat: "Deception", type: "item", value: getStandardBonus(level) },
            { stat: "Diplomacy", type: "item", value: getStandardBonus(level) },
            { stat: "Intimidation", type: "item", value: getStandardBonus(level) },
            { stat: "Performance", type: "item", value: getStandardBonus(level) }
        ],
        penalties: (level) => [
            { stat: "Arcana", type: "item", value: -2 },
            { stat: "Crafting", type: "item", value: -2 },
            { stat: "Lore", type: "item", value: -2 },
            { stat: "Occultism", type: "item", value: -2 },
            { stat: "Society", type: "item", value: -2 }
        ]
    },
    "Cognitive Mutagen": {
        bonuses: (level) => [
            { stat: "Arcana", type: "item", value: getStandardBonus(level) },
            { stat: "Crafting", type: "item", value: getStandardBonus(level) },
            { stat: "Lore", type: "item", value: getStandardBonus(level) },
            { stat: "Occultism", type: "item", value: getStandardBonus(level) },
            { stat: "Society", type: "item", value: getStandardBonus(level) }
        ],
        penalties: (level) => [
            { stat: "Athletics", type: "item", value: -2 },
            { stat: "Acrobatics", type: "item", value: -2 },
            { stat: "Attack", type: "item", value: -2 }
        ]
    }
};

export function getMutagenEffects(name, level = 1) {
    if (!name) return null;
    // Flexible matching: "Lesser Bestial Mutagen" -> "Bestial Mutagen"
    const key = Object.keys(MUTAGEN_DATA).find(k => name.includes(k));
    if (!key) return null;

    const data = MUTAGEN_DATA[key];
    return {
        key,
        bonuses: data.bonuses(level),
        penalties: data.penalties(level)
    };
}
