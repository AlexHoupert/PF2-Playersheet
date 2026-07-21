// Game Rules and Calculation Logic

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
    const selectors = getStatSelectors(statName, attributeName);
    const effects = getRuntimeEffectList(character);

    const resolved = resolveEffectModifiersForSelectors(effects, selectors);
    const itemBonus = Math.max(
        0,
        ...resolved.applied
            .filter(modifier => (modifier.bonusType || "untyped") === "item")
            .map(modifier => Number(modifier.value) || 0)
    );
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
        itemBonus,
        applied: resolved.applied,
    };
}

function getConditionList(character) {
    const effectConditions = getRuntimeEffectList(character)
        .filter(effect => effect.category === "condition")
        .map(effect => ({
            id: effect.id,
            name: effect.label || effect.name,
            level: Number.isFinite(Number(effect.value)) ? Number(effect.value) : 1,
            hidden: effect.hidden,
            disabled: effect.disabled,
            modifiers: effect.modifiers,
        }));
    if (effectConditions.length > 0) return effectConditions;
    const { conditions = [] } = character || {};
    return Array.isArray(conditions) ? conditions : [];
}

function getRuntimeEffectList(character) {
    const effectSources = [
        ...(Array.isArray(character?.actorEffects) ? character.actorEffects : []),
        ...(Array.isArray(character?.effects) ? character.effects : []),
    ];

    if (effectSources.length > 0) {
        return effectSources.map(normalizeRuntimeEffect).filter(Boolean);
    }

    const legacyConditions = Array.isArray(character?.["conditions"]) ? character["conditions"] : [];
    return legacyConditions.map(conditionToRuntimeEffect).filter(Boolean);
}

function normalizeRuntimeEffect(effect) {
    if (!effect) return null;
    const label = effect.label || effect.name || "";
    const value = Number.isFinite(Number(effect.value)) ? Number(effect.value) : 1;
    const canonicalConditionModifiers = effect.category === "condition"
        ? buildStandardConditionModifiers(label, value)
        : [];
    const modifiers = canonicalConditionModifiers.length > 0
        ? canonicalConditionModifiers
        : Array.isArray(effect.modifiers) ? effect.modifiers : [];
    return {
        ...effect,
        id: effect.id || `effect:${label}`,
        label,
        value,
        modifiers,
    };
}

function conditionToRuntimeEffect(condition) {
    if (!condition) return null;
    const name = typeof condition === "string" ? condition : (condition.name || condition.label);
    if (!name) return null;
    const value = typeof condition === "string" ? 1 : (Number.isFinite(Number(condition.level ?? condition.value)) ? Number(condition.level ?? condition.value) : 1);
    return {
        id: condition.id || `condition:${name}`,
        label: name,
        category: "condition",
        disabled: condition.disabled,
        value,
        modifiers: Array.isArray(condition.modifiers) && condition.modifiers.length > 0
            ? condition.modifiers
            : buildStandardConditionModifiers(name, value),
    };
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
    } else if (stat === "Spell Attack") {
        selectors.add("attack.all");
        selectors.add("spell.attack");
        selectors.add("all.checks");
    } else if (stat === "Spell DC") {
        selectors.add("spell.dc");
        selectors.add("all.dcs");
    } else if (stat === "Spell") {
        selectors.add("attack.all");
        selectors.add("spell.attack");
        selectors.add("spell.dc");
        selectors.add("all.checks");
        selectors.add("all.dcs");
    } else if (stat === "Impulse Attack") {
        selectors.add("attack.all");
        selectors.add("impulse.attack");
        selectors.add("all.checks");
    } else if (stat === "Impulse DC") {
        selectors.add("impulse.dc");
        selectors.add("all.dcs");
    } else if (stat === "Impulse") {
        selectors.add("attack.all");
        selectors.add("impulse.attack");
        selectors.add("impulse.dc");
        selectors.add("all.checks");
        selectors.add("all.dcs");
    } else if (stat.includes("Attack")) {
        selectors.add("attack.all");
        selectors.add(lowerStat.includes("ranged") ? "attack.ranged" : "attack.melee");
        if (lowerAttr === "strength" || lowerAttr === "dexterity") selectors.add(`attack.${lowerAttr}`);
        selectors.add("all.checks");
    } else if (stat) {
        selectors.add(`skill.${lowerStat}`);
        selectors.add("all.checks");
    }

    return [...selectors];
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
    const attackEffects = getConditionEffects(character, "Spell Attack", attrName);
    const dcEffects = getConditionEffects(character, "Spell DC", attrName);
    const totalAttack = baseAttack + attackEffects.total;
    const totalDc = 10 + baseAttack + dcEffects.total;

    const baseBreakdown = {
        attribute: attrMod,
        proficiency: prof,
        ...(prof > 0 ? { level } : {}),
    };

    const source = {
        attrName: attrName.substr(0, 3),
        attrFull: attrName,
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        attack: {
            total: totalAttack,
            breakdown: { ...baseBreakdown, ...attackEffects.breakdown },
            source,
            penalty: attackEffects.total,
        },
        dc: {
            total: totalDc,
            base: 10,
            breakdown: { ...baseBreakdown, ...dcEffects.breakdown },
            source,
            penalty: dcEffects.total,
        }
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
    const attackEffects = getConditionEffects(character, "Impulse Attack", "Constitution");
    const dcEffects = getConditionEffects(character, "Impulse DC", "Constitution");
    const totalAttack = baseAttack + attackEffects.total;
    const totalDc = 10 + baseAttack + dcEffects.total;

    const baseBreakdown = {
        attribute: conMod,
        proficiency: prof,
        ...(prof > 0 ? { level } : {}),
    };

    const source = {
        attrName: "Con",
        attrFull: "Constitution",
        profName: PROF_NAMES[prof] || "Unknown",
        levelVal: level
    };

    return {
        attack: {
            total: totalAttack,
            breakdown: { ...baseBreakdown, ...attackEffects.breakdown },
            source,
            penalty: attackEffects.total,
        },
        classDC: {
            total: totalDc,
            base: 10,
            breakdown: { ...baseBreakdown, ...dcEffects.breakdown },
            source,
            penalty: dcEffects.total,
        }
    };
}
