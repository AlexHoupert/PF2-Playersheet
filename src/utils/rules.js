// Game Rules and Calculation Logic

import { getMutagenEffects } from './rules/mutagens';
import { buildStandardConditionModifiers } from '../shared/rules/conditionEffectRules.js';
import { resolveEffectModifiersForSelectors } from '../shared/rules/effectResolver.js';

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
    const conditions = getConditionList(character);
    if (conditions.length === 0) return 0;
    const target = String(condName).toLowerCase();
    const found = conditions.find(cond => {
        if (typeof cond === 'string') return cond.toLowerCase() === target;
        return String(cond?.name || cond?.label || '').toLowerCase() === target;
    });

    if (!found) return 0;
    if (typeof found === 'string') return 1;

    const lvl = Number(found.level ?? found.value);
    if (Number.isFinite(lvl)) return lvl;
    return 1;
}

export function getConditionEffects(character, statName, attributeName) {
    const conds = getConditionList(character);
    const selectors = getStatSelectors(statName, attributeName);
    const effects = [];
    const currentStatModifiers = [];

    conds.forEach(c => {
        if (!c) return;
        const name = (typeof c === 'string') ? c : (c.name || c.label);
        if (!name) return;

        const rawLevel = (typeof c === 'string') ? 1 : (c.level ?? c.value);
        const level = Number.isFinite(Number(rawLevel)) ? Number(rawLevel) : 1;
        effects.push({
            id: c.id || `condition:${name}`,
            label: name,
            disabled: c.disabled,
            modifiers: Array.isArray(c.modifiers) ? c.modifiers : buildStandardConditionModifiers(name, level),
        });

        const mutagen = getMutagenEffects(name, level);
        if (mutagen) {
            mutagen.bonuses.forEach(eff => {
                const match = eff.stat === statName || eff.stat === attributeName ||
                    (eff.stat === "Attack" && statName.includes("Attack")) ||
                    (eff.stat === "Damage" && statName.includes("Damage")) ||
                    (eff.stat === "Dexterity Actions" && attributeName === "Dexterity" && statName !== "AC");

                if (match) {
                    currentStatModifiers.push(toCurrentStatModifier(eff, name));
                }
            });
            mutagen.penalties.forEach(eff => {
                const match = eff.stat === statName || eff.stat === attributeName ||
                    (eff.stat === "Attack" && statName.includes("Attack"));
                if (match) {
                    currentStatModifiers.push(toCurrentStatModifier(eff, name));
                }
            });
        }
    });

    if (currentStatModifiers.length) {
        selectors.push("__current_stat");
        effects.push({
            id: "legacy-mutagen-current-stat",
            label: "Mutagen",
            modifiers: currentStatModifiers,
        });
    }

    const resolved = resolveEffectModifiersForSelectors(effects, selectors);
    const meta = buildModifierMeta(resolved.applied);
    const breakdown = {
        ...resolved.breakdown,
        ...(resolved.breakdown.untyped ? { misc: resolved.breakdown.untyped } : {}),
    };
    delete breakdown.untyped;

    return {
        total: resolved.total,
        breakdown,
        meta,
    };
}

function getConditionList(character) {
    const { conditions = [] } = character || {};
    return Array.isArray(conditions) ? conditions : [];
}

function getStatSelectors(statName, attributeName) {
    const selectors = new Set();
    const stat = String(statName || "").trim();
    const lowerStat = stat.toLowerCase();
    const lowerAttr = String(attributeName || "").trim().toLowerCase();

    if (lowerAttr) selectors.add(`attribute.${lowerAttr}`);

    if (stat === "AC") {
        selectors.add("ac");
        selectors.add("all.dcs");
    } else if (["Fortitude", "Reflex", "Will"].includes(stat)) {
        selectors.add(`save.${lowerStat}`);
        selectors.add("all.checks");
    } else if (stat === "Perception") {
        selectors.add("perception");
        selectors.add("all.checks");
    } else if (stat === "Spell") {
        selectors.add("spell.attack");
        selectors.add("spell.dc");
        selectors.add("all.checks");
        selectors.add("all.dcs");
    } else if (stat === "Impulse") {
        selectors.add("impulse.attack");
        selectors.add("impulse.dc");
        selectors.add("all.checks");
        selectors.add("all.dcs");
    } else if (stat.includes("Attack")) {
        selectors.add(lowerStat.includes("ranged") ? "ranged.attack" : "melee.attack");
        selectors.add("all.checks");
    } else if (stat) {
        selectors.add(`skill.${lowerStat}`);
        selectors.add("all.checks");
    }

    return [...selectors];
}

function toCurrentStatModifier(effect, source) {
    const value = Number(effect.value) || 0;
    return {
        selector: "__current_stat",
        mode: value < 0 ? "penalty" : "bonus",
        bonusType: effect.type || "item",
        value,
        source,
    };
}

function buildModifierMeta(applied) {
    const meta = { statusSource: [], itemSource: [], circSource: [] };
    for (const modifier of applied || []) {
        const bonusType = modifier.bonusType || "untyped";
        const value = Number(modifier.value) || 0;
        const source = modifier.source || modifier.sourceLabel || "Effect";
        const label = `${source} ${value > 0 ? '+' : ''}${value}`;
        if (bonusType === "status") meta.statusSource.push(label);
        if (bonusType === "item") meta.itemSource.push(label);
        if (bonusType === "circumstance") meta.circSource.push(label);
    }
    return {
        statusSource: [...new Set(meta.statusSource)],
        itemSource: [...new Set(meta.itemSource)],
        circSource: [...new Set(meta.circSource)],
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
