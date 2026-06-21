export function resolveEffectModifiers(effects = [], selector) {
    return resolveEffectModifiersForSelectors(effects, [selector]);
}

export function resolveEffectModifiersForSelectors(effects = [], selectors = []) {
    const matching = collectMatchingModifiers(effects, selectors);
    const breakdown = {};
    const applied = [];
    let total = 0;
    let cap = null;

    for (const bonusType of ["item", "status", "circumstance", "untyped"]) {
        const typed = matching.filter(modifier =>
            (modifier.bonusType || "untyped") === bonusType &&
            ["bonus", "penalty"].includes(modifier.mode || "bonus")
        );
        if (typed.length === 0) continue;

        if (bonusType === "untyped") {
            const sum = typed.reduce((acc, modifier) => acc + toFiniteNumber(modifier.value, 0), 0);
            if (sum !== 0) breakdown.untyped = (breakdown.untyped || 0) + sum;
            total += sum;
            applied.push(...typed);
            continue;
        }

        const bonuses = typed.filter(modifier => toFiniteNumber(modifier.value, 0) > 0);
        const penalties = typed.filter(modifier => toFiniteNumber(modifier.value, 0) < 0);
        const bestBonus = pickBest(bonuses, "max");
        const worstPenalty = pickBest(penalties, "min");

        const typedTotal = toFiniteNumber(bestBonus?.value, 0) + toFiniteNumber(worstPenalty?.value, 0);
        if (typedTotal !== 0) breakdown[bonusType] = typedTotal;
        total += typedTotal;
        if (bestBonus) applied.push(bestBonus);
        if (worstPenalty) applied.push(worstPenalty);
    }

    const caps = matching.filter(modifier => modifier.mode === "cap");
    if (caps.length > 0) {
        const capModifier = pickBest(caps, "min");
        cap = toFiniteNumber(capModifier.value, null);
        if (capModifier) applied.push(capModifier);
    }

    return {
        total,
        breakdown,
        cap,
        applied,
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
    const normalizedSelectors = new Set(
        (Array.isArray(selector) ? selector : [selector])
            .map(item => String(item || "").toLowerCase())
            .filter(Boolean)
    );
    return collectAllModifiers(effects).filter(modifier =>
        normalizedSelectors.has(String(modifier.selector || "").toLowerCase())
    );
}

function collectAllModifiers(effects) {
    return (effects || [])
        .filter(effect => effect && !effect.disabled)
        .flatMap(effect => (effect.modifiers || []).map(modifier => ({
            ...modifier,
            sourceEffectId: effect.id,
            sourceLabel: effect.label,
        })));
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
