const BONUS_TYPES = ["item", "status", "circumstance", "untyped"];
const SELECTOR_ALIASES = Object.freeze({
    "melee.attack": "attack.melee",
    "ranged.attack": "attack.ranged",
});

const SKILL_ATTRIBUTE_SELECTORS = Object.freeze({
    acrobatics: "attribute.dexterity",
    arcana: "attribute.intelligence",
    athletics: "attribute.strength",
    crafting: "attribute.intelligence",
    deception: "attribute.charisma",
    diplomacy: "attribute.charisma",
    intimidation: "attribute.charisma",
    medicine: "attribute.wisdom",
    nature: "attribute.wisdom",
    occultism: "attribute.intelligence",
    performance: "attribute.charisma",
    religion: "attribute.wisdom",
    society: "attribute.intelligence",
    stealth: "attribute.dexterity",
    survival: "attribute.wisdom",
    thievery: "attribute.dexterity",
});

const SELECTOR_PARENTS = Object.freeze({
    ac: ["attribute.dexterity", "all.dcs"],
    perception: ["attribute.wisdom", "all.checks"],
    initiative: ["all.checks"],
    "save.fortitude": ["attribute.constitution", "all.checks"],
    "save.reflex": ["attribute.dexterity", "all.checks"],
    "save.will": ["attribute.wisdom", "all.checks"],
    "attack.all": ["all.checks"],
    "attack.strength": ["attribute.strength", "attack.all", "all.checks"],
    "attack.dexterity": ["attribute.dexterity", "attack.all", "all.checks"],
    "attack.melee": ["attack.all", "all.checks"],
    "attack.ranged": ["attack.all", "all.checks"],
    "spell.attack": ["attack.all", "all.checks"],
    "impulse.attack": ["attack.all", "all.checks"],
    "spell.dc": ["all.dcs"],
    "impulse.dc": ["all.dcs"],
    "class.dc": ["all.dcs"],
});

export function resolveEffectModifiers(effects = [], selector) {
    return resolveEffectModifiersForSelectors(effects, [selector]);
}

export function resolveEffectModifiersForSelectors(effects = [], selectors = []) {
    const explained = explainEffectModifiersForSelectors(effects, selectors);
    return {
        total: explained.total,
        breakdown: explained.breakdown,
        cap: explained.cap,
        set: explained.set,
        applied: explained.applied,
    };
}

export function explainEffectModifiersForSelectors(effects = [], selectors = []) {
    const matching = collectMatchingModifiers(effects, selectors);
    const dependencyResult = resolveDependencyConflicts(matching);
    const eligible = dependencyResult.eligible;
    const suppressed = new Map(dependencyResult.suppressed);
    const appliedKeys = new Set();
    const breakdown = {};
    const applied = [];
    let total = 0;
    let cap = null;
    let set = null;

    for (const bonusType of BONUS_TYPES) {
        const typed = eligible.filter(modifier =>
            (modifier.bonusType || "untyped") === bonusType
            && ["bonus", "penalty"].includes(modifier.mode || "bonus")
        );
        if (typed.length === 0) continue;

        if (bonusType === "untyped") {
            const sum = typed.reduce((acc, modifier) => acc + toFiniteNumber(modifier.value, 0), 0);
            if (sum !== 0) breakdown.untyped = (breakdown.untyped || 0) + sum;
            total += sum;
            typed.forEach(modifier => markApplied(modifier, appliedKeys, applied));
            continue;
        }

        const bonuses = typed.filter(modifier => toFiniteNumber(modifier.value, 0) > 0);
        const penalties = typed.filter(modifier => toFiniteNumber(modifier.value, 0) < 0);
        const bestBonus = pickBest(bonuses, "max");
        const worstPenalty = pickBest(penalties, "min");

        suppressUnselected(bonuses, bestBonus, suppressed, `Lower or equal ${bonusType} bonus`);
        suppressUnselected(penalties, worstPenalty, suppressed, `Weaker or equal ${bonusType} penalty`);

        const typedTotal = toFiniteNumber(bestBonus?.value, 0) + toFiniteNumber(worstPenalty?.value, 0);
        if (typedTotal !== 0) breakdown[bonusType] = typedTotal;
        total += typedTotal;
        markApplied(bestBonus, appliedKeys, applied);
        markApplied(worstPenalty, appliedKeys, applied);
    }

    const caps = eligible.filter(modifier => modifier.mode === "cap");
    if (caps.length > 0) {
        const capModifier = pickBest(caps, "min");
        cap = toFiniteNumber(capModifier?.value, null);
        suppressUnselected(caps, capModifier, suppressed, "Higher cap is not restrictive");
        markApplied(capModifier, appliedKeys, applied);
    }

    const sets = eligible.filter(modifier => modifier.mode === "set");
    if (sets.length > 0) {
        const setModifier = pickBest(sets, "max");
        set = toFiniteNumber(setModifier?.value, null);
        suppressUnselected(sets, setModifier, suppressed, "Lower set value is not selected");
        markApplied(setModifier, appliedKeys, applied);
    }

    for (const modifier of eligible) {
        if (appliedKeys.has(modifier.resolutionKey) || suppressed.has(modifier.resolutionKey)) continue;
        suppressed.set(modifier.resolutionKey, "Resolved by a dedicated damage rule");
    }

    return {
        total,
        breakdown,
        cap,
        set,
        applied: applied.map(toPublicModifier),
        contributions: matching.map(modifier => ({
            ...toPublicModifier(modifier),
            effectId: modifier.sourceEffectId,
            modifierId: modifier.id || modifier.resolutionKey,
            declaredSelector: normalizeEffectSelector(modifier.selector),
            source: modifier.sourceEffect?.source || null,
            sourceActorId: modifier.sourceEffect?.source?.actorId
                || modifier.sourceEffect?.application?.sourceActorId
                || null,
            category: modifier.sourceEffect?.category || "custom",
            duration: modifier.sourceEffect?.duration || null,
            derived: Boolean(modifier.sourceEffect?.derived),
            applied: appliedKeys.has(modifier.resolutionKey),
            suppressionReason: suppressed.get(modifier.resolutionKey) || null,
        })),
    };
}

export function resolveDamageEffects(effects = []) {
    const persistentByType = {};
    for (const modifier of collectAllModifiers(effects).filter(modifier => modifier.mode === "persistent_damage")) {
        const damageType = modifier.damageType || "untyped";
        const current = persistentByType[damageType];
        if (!current || toFiniteNumber(modifier.value, 0) > toFiniteNumber(current.value, 0)) {
            persistentByType[damageType] = modifier;
        }
    }
    return { persistentByType };
}

export function resolveResistanceWeakness(effects = []) {
    const resistanceByType = {};
    const weaknessByType = {};

    for (const modifier of collectAllModifiers(effects)) {
        const damageType = modifier.damageType || "all";
        const value = Math.max(0, toFiniteNumber(modifier.value, 0));
        if (modifier.mode === "resistance") {
            resistanceByType[damageType] = Math.max(resistanceByType[damageType] || 0, value);
        }
        if (modifier.mode === "weakness") {
            weaknessByType[damageType] = Math.max(weaknessByType[damageType] || 0, value);
        }
    }

    const netByType = {};
    for (const damageType of new Set([...Object.keys(resistanceByType), ...Object.keys(weaknessByType)])) {
        const resistance = resistanceByType[damageType] || 0;
        const weakness = weaknessByType[damageType] || 0;
        const net = resistance - weakness;
        netByType[damageType] = {
            resistance,
            weakness,
            netResistance: Math.max(0, net),
            netWeakness: Math.max(0, -net),
        };
    }

    return { resistanceByType, weaknessByType, netByType };
}

function collectMatchingModifiers(effects, selector) {
    const normalizedSelectors = new Set(expandEffectResolutionSelectors(selector));
    return collectAllModifiers(effects).filter(modifier =>
        normalizedSelectors.has(normalizeEffectSelector(modifier.selector))
    );
}

export function expandEffectResolutionSelectors(selectors = []) {
    const expanded = new Set();
    const visit = (rawSelector) => {
        const selector = normalizeEffectSelector(rawSelector);
        if (!selector || expanded.has(selector)) return;
        expanded.add(selector);

        const skillName = selector.startsWith("skill.") ? selector.slice("skill.".length) : null;
        if (skillName) {
            visit("all.checks");
            visit(SKILL_ATTRIBUTE_SELECTORS[skillName]);
        }
        for (const parent of SELECTOR_PARENTS[selector] || []) visit(parent);
    };

    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) visit(selector);
    return [...expanded];
}

export function normalizeEffectSelector(selector) {
    const normalized = String(selector || "").toLowerCase();
    return SELECTOR_ALIASES[normalized] || normalized;
}

function resolveDependencyConflicts(modifiers) {
    const eligible = modifiers.filter(modifier => !modifier.dependencyKey);
    const suppressed = new Map();
    const groups = new Map();
    for (const modifier of modifiers.filter(item => item.dependencyKey)) {
        const key = String(modifier.dependencyKey);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(modifier);
    }
    for (const [key, group] of groups.entries()) {
        const positives = group.filter(modifier => toFiniteNumber(modifier.value, 0) >= 0);
        const negatives = group.filter(modifier => toFiniteNumber(modifier.value, 0) < 0);
        const bestPositive = pickBest(positives, "max");
        const worstNegative = pickBest(negatives, "min");
        if (bestPositive) eligible.push(bestPositive);
        if (worstNegative) eligible.push(worstNegative);
        suppressUnselected(positives, bestPositive, suppressed, `Dependency conflict: ${key}`);
        suppressUnselected(negatives, worstNegative, suppressed, `Dependency conflict: ${key}`);
    }
    return { eligible, suppressed };
}

function collectAllModifiers(effects) {
    return (effects || [])
        .filter(effect => effect && !effect.disabled)
        .flatMap((effect, effectIndex) => (effect.modifiers || []).map((modifier, modifierIndex) => ({
            ...modifier,
            resolutionKey: `${effect.id || effectIndex}:${modifier.id || modifierIndex}`,
            sourceEffectId: effect.id,
            sourceLabel: effect.label,
            sourceEffect: effect,
        })));
}

function markApplied(modifier, appliedKeys, applied) {
    if (!modifier) return;
    appliedKeys.add(modifier.resolutionKey);
    applied.push(modifier);
}

function suppressUnselected(modifiers, selected, suppressed, reason) {
    for (const modifier of modifiers) {
        if (modifier !== selected) suppressed.set(modifier.resolutionKey, reason);
    }
}

function toPublicModifier(modifier) {
    if (!modifier) return null;
    const { resolutionKey: _resolutionKey, sourceEffect: _sourceEffect, ...publicModifier } = modifier;
    return publicModifier;
}

function pickBest(modifiers, mode) {
    if (!modifiers.length) return null;
    return modifiers.reduce((best, modifier) => {
        const bestValue = toFiniteNumber(best.value, 0);
        const value = toFiniteNumber(modifier.value, 0);
        return mode === "min"
            ? (value < bestValue ? modifier : best)
            : (value > bestValue ? modifier : best);
    }, modifiers[0]);
}

function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
