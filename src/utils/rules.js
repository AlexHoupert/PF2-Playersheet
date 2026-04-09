// Game Rules and Calculation Logic

import { getMutagenEffects } from './rules/mutagens';

export const STAT_MAP = {
    "Fortitude": "Constitution", "Reflex": "Dexterity", "Will": "Wisdom", "Perception": "Wisdom",
    "Acrobatics": "Dexterity", "Arcana": "Intelligence", "Athletics": "Strength", "Crafting": "Intelligence",
    "Deception": "Charisma", "Diplomacy": "Charisma", "Intimidation": "Charisma", "Medicine": "Wisdom",
    "Nature": "Wisdom", "Occultism": "Intelligence", "Performance": "Charisma", "Religion": "Wisdom",
    "Society": "Intelligence", "Stealth": "Dexterity", "Survival": "Wisdom", "Thievery": "Dexterity",
    "Perform": "Charisma", "perform": "Charisma"
};

export const PROF_NAMES = { 0: "Untrained", 2: "Trained", 4: "Expert", 6: "Master", 8: "Legendary" };

export function getCondLevel(condName, character) {
    if (!character || !character.conditions) return 0;
    const target = String(condName).toLowerCase();
    const found = character.conditions.find(cond => {
        if (typeof cond === 'string') return cond.toLowerCase() === target;
        return String(cond?.name || '').toLowerCase() === target;
    });

    if (!found) return 0;
    if (typeof found === 'string') return 1;

    const lvl = Number(found.level);
    if (Number.isFinite(lvl)) return lvl;
    return 1;
}

export function getConditionEffects(character, statName, attributeName) {
    const conds = character.conditions || [];
    const modifiers = [];

    // 1. Collect all modifiers (Standard + Mutagens)
    conds.forEach(c => {
        if (!c) return;
        const name = (typeof c === 'string') ? c : c.name;
        if (!name) return;
        const lowerName = name.toLowerCase();

        const rawLevel = (typeof c === 'string') ? 1 : c.level;
        const level = Number.isFinite(Number(rawLevel)) ? Number(rawLevel) : 1;
        const val = level; // Magnitude usually equals level for things like Frightened

        // --- Standard Conditions (Status / Circumstance) ---
        if (lowerName === "frightened") { modifiers.push({ type: 'status', value: -val, source: `Frightened ${val}` }); }
        if (lowerName === "sickened") { modifiers.push({ type: 'status', value: -val, source: `Sickened ${val}` }); }

        // Attribute Penalties
        if (attributeName) {
            if (attributeName === "Strength" && lowerName === "enfeebled") modifiers.push({ type: 'status', value: -val, source: `Enfeebled ${val}` });
            if (attributeName === "Dexterity") {
                if (lowerName === "clumsy") modifiers.push({ type: 'status', value: -val, source: `Clumsy ${val}` });
                if (lowerName === "encumbered") modifiers.push({ type: 'status', value: -1, source: "Encumbered" }); // Clumsy is status, Encumbered is also status usually? Actually Encumbered is Clumsy 1 + Speed penalty.
            }
            if (attributeName === "Constitution" && lowerName === "drained") modifiers.push({ type: 'status', value: -val, source: `Drained ${val}` });
            if (["Intelligence", "Wisdom", "Charisma"].includes(attributeName) && lowerName === "stupefied") modifiers.push({ type: 'status', value: -val, source: `Stupefied ${val}` });
        }

        // AC/Save Penalties
        if (["AC", "Fortitude", "Reflex", "Will"].includes(statName)) {
            if (lowerName === "fatigued") modifiers.push({ type: 'status', value: -1, source: "Fatigued" });
        }

        // Perception Penalties
        if (statName === "Perception") {
            if (lowerName === "blinded") modifiers.push({ type: 'status', value: -4, source: "Blinded" });
            if (lowerName === "deafened") modifiers.push({ type: 'status', value: -2, source: "Deafened" });
            if (lowerName === "unconscious") modifiers.push({ type: 'status', value: -4, source: "Unconscious" });
        }

        // AC Circumstance
        if (statName === "AC") {
            if (["off-guard", "blinded", "grabbed", "paralyzed", "prone", "restrained", "unconscious"].includes(lowerName)) {
                modifiers.push({ type: 'circumstance', value: -2, source: "Off-Guard (or similar)" });
            }
        }

        // --- Mutagen Effects (Item) ---
        // Check if condition name matches a known mutagen
        const mutagen = getMutagenEffects(name, level);
        if (mutagen) {
            // Check Bonuses
            mutagen.bonuses.forEach(eff => {
                // lenient match: "Athletics", "Unarmed Attack", "Attack", "Specific Skill"
                const match = eff.stat === statName || eff.stat === attributeName ||
                    (eff.stat === "Attack" && statName.includes("Attack")) || // e.g. "Melee Attack"
                    (eff.stat === "Damage" && statName.includes("Damage")) ||
                    // Quicksilver Mutagen: "Dexterity Actions" applies to all Dex-based checks (Skills, Attacks) but NOT AC.
                    (eff.stat === "Dexterity Actions" && attributeName === "Dexterity" && statName !== "AC");

                if (match) {
                    modifiers.push({ type: eff.type || 'item', value: eff.value, source: name });
                }
            });
            // Check Penalties
            mutagen.penalties.forEach(eff => {
                const match = eff.stat === statName || eff.stat === attributeName ||
                    (eff.stat === "Attack" && statName.includes("Attack"));
                if (match) {
                    modifiers.push({ type: eff.type || 'item', value: eff.value, source: name });
                }
            });
        }
    });

    // 2. Stacking Logic (Group by Type)
    const grouped = { status: [], item: [], circumstance: [], untyped: [] };
    modifiers.forEach(m => {
        const t = m.type || 'untyped';
        if (grouped[t]) grouped[t].push(m);
        else grouped.untyped.push(m);
    });

    const breakdown = {};
    const meta = { statusSource: [], itemSource: [], circSource: [] };
    let finalTotal = 0;

    // Process Types
    ['status', 'item', 'circumstance'].forEach(type => {
        const mods = grouped[type];
        if (mods.length === 0) return;

        // Max Positive
        const bonuses = mods.filter(m => m.value > 0).map(m => m.value);
        const maxBonus = bonuses.length ? Math.max(...bonuses) : 0;

        // Min Negative (Worst Penalty) -> Min of { -1, -2 } is -2 (the smallest number)
        const penalties = mods.filter(m => m.value < 0).map(m => m.value);
        const minPenalty = penalties.length ? Math.min(...penalties) : 0;

        const net = maxBonus + minPenalty;
        if (net !== 0) {
            breakdown[type] = net;
            finalTotal += net;
        }

        // Metadata for tooltip
        mods.forEach(m => {
            if ((m.value > 0 && m.value === maxBonus) || (m.value < 0 && m.value === minPenalty)) {
                if (type === 'status') meta.statusSource.push(`${m.source} ${m.value > 0 ? '+' : ''}${m.value}`);
                if (type === 'item') meta.itemSource.push(`${m.source} ${m.value > 0 ? '+' : ''}${m.value}`);
                if (type === 'circumstance') meta.circSource.push(`${m.source} ${m.value > 0 ? '+' : ''}${m.value}`);
            }
        });
    });

    // Untyped (Stacking)
    grouped.untyped.forEach(m => {
        finalTotal += m.value;
        // Add to breakdown? Untyped usually merge into Base or Misc
        if (!breakdown.misc) breakdown.misc = 0;
        breakdown.misc += m.value;
    });

    return {
        total: finalTotal,
        breakdown,
        meta: {
            statusSource: [...new Set(meta.statusSource)], // Dedupe
            itemSource: [...new Set(meta.itemSource)],
            circSource: [...new Set(meta.circSource)]
        }
    };
}

export function calculateStat(character, statName, profValue) {
    const level = parseInt(character.level) || 1;
    const prof = parseInt(profValue) || 0;
    let attrKey = "Intelligence";

    // Normalize skill name to Title Case for STAT_MAP lookup (handles lowercase keys from new DB format)
    const normalizedName = statName.charAt(0).toUpperCase() + statName.slice(1);
    if (!normalizedName.startsWith("Lore")) attrKey = STAT_MAP[normalizedName] || STAT_MAP[statName] || "Strength";
    if (statName === "AC") attrKey = "Dexterity";

    const attrVal = parseInt(character.stats.attributes[attrKey.toLowerCase()]) || 0;
    const cond = getConditionEffects(character, statName, attrKey);

    let total = (prof > 0) ? prof + level + attrVal : attrVal;
    total += cond.total; // Add net condition modifiers

    const breakdown = {
        attribute: attrVal,
        ...cond.breakdown
    };

    if (prof > 0) {
        breakdown.proficiency = prof;
        breakdown.level = level;
    }

    const source = {
        attrName: attrKey.substr(0, 3),
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        total,
        breakdown,
        source,
        rank: PROF_NAMES[prof] || "Unknown",
        penalty: cond.total < 0 ? cond.total : 0,
        bonus: cond.total > 0 ? cond.total : 0 // Expose pure bonus for Green text
    };
}

export function calculateSpellAttackAndDC(character) {
    if (!character) {
        return {
            attack: { total: 0, breakdown: {}, source: {}, penalty: 0 },
            dc: { total: 10, base: 10, breakdown: {}, source: {}, penalty: 0 }
        };
    }

    const magic = character.magic || {};
    const attrName = magic.attribute || "Intelligence";
    const attrMod = parseInt(character.stats?.attributes?.[(attrName || "").toLowerCase()]) || 0;
    const prof = parseInt(magic.proficiency) || 0;
    const level = parseInt(character.level) || 0;

    const baseAttack = Math.floor(attrMod + prof + (prof > 0 ? level : 0));
    const cond = getConditionEffects(character, "Spell", attrName);
    const totalAttack = baseAttack + cond.total;

    const breakdown = {
        attribute: attrMod,
        proficiency: prof,
        ...(prof > 0 ? { level } : {}),
        ...cond.breakdown
    };

    const source = {
        attrName: attrName.substr(0, 3),
        attrFull: attrName,
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        attack: { total: totalAttack, breakdown, source, penalty: cond.total },
        dc: { total: 10 + totalAttack, base: 10, breakdown, source, penalty: cond.total }
    };
}

export function calculateImpulseAttackAndClassDC(character) {
    if (!character) {
        return {
            attack: { total: 0, breakdown: {}, source: {}, penalty: 0 },
            classDC: { total: 10, base: 10, breakdown: {}, source: {}, penalty: 0 }
        };
    }

    const prof = parseInt(character.stats?.impulse_proficiency) || 0;
    const level = Math.max(1, parseInt(character.level) || 1);
    const conMod = parseInt(character.stats?.attributes?.constitution) || 0;

    const baseAttack = conMod + (prof > 0 ? (level + prof) : 0);
    const cond = getConditionEffects(character, "Impulse", "Constitution");
    const totalAttack = baseAttack + cond.total;

    const breakdown = {
        attribute: conMod,
        proficiency: prof,
        ...(prof > 0 ? { level } : {}),
        ...cond.breakdown
    };

    const source = {
        attrName: "Con",
        attrFull: "Constitution",
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        attack: { total: totalAttack, breakdown, source, penalty: cond.total },
        classDC: { total: 10 + totalAttack, base: 10, breakdown, source, penalty: cond.total }
    };
}
