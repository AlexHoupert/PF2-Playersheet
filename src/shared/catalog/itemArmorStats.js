export function isArmorOrShieldItem(item = {}) {
    const data = item?.data || {};
    const system = item?.system || data?.system || {};
    const type = String(item?.type || data?.type || '').toLowerCase();
    const category = String(item?.category ?? data?.category ?? system?.category ?? '').toLowerCase();
    return type === 'armor'
        || type === 'shield'
        || category.includes('armor')
        || category.includes('shield');
}

export function readItemArmorStats(item = {}) {
    const data = item?.data || {};
    const system = item?.system || data?.system || {};
    return {
        acBonus: firstOptionalNumber(
            item?.acBonus,
            data?.acBonus,
            system?.acBonus,
            system?.ac_bonus,
            system?.ac?.value
        ),
        dexCap: firstOptionalNumber(
            item?.dexCap,
            data?.dexCap,
            system?.dexCap,
            system?.dex_cap
        ),
        checkPenalty: firstOptionalNumber(item?.checkPenalty, data?.checkPenalty, system?.checkPenalty),
        speedPenalty: firstOptionalNumber(item?.speedPenalty, data?.speedPenalty, system?.speedPenalty),
        strength: firstOptionalNumber(item?.strength, data?.strength, system?.strength),
        hardness: firstOptionalNumber(item?.hardness, data?.hardness, system?.hardness),
        hpMax: firstOptionalNumber(
            item?.hpMax,
            data?.hpMax,
            item?.hp?.max,
            data?.hp?.max,
            system?.hp?.max
        ),
    };
}

export function buildItemArmorSystemFields(values = {}) {
    const stats = readItemArmorStats(values);
    const fields = compactOptionalNumbers({
        acBonus: stats.acBonus,
        dexCap: stats.dexCap,
        checkPenalty: stats.checkPenalty,
        speedPenalty: stats.speedPenalty,
        strength: stats.strength,
        hardness: stats.hardness,
    });
    if (stats.hpMax !== null) {
        fields.hp = { value: stats.hpMax, max: stats.hpMax };
    }
    return fields;
}

export function buildItemArmorFlatFields(values = {}) {
    return compactOptionalNumbers(readItemArmorStats(values));
}

export function parseOptionalItemNumber(value) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function resolveArmorDexterityCap(armorCap, effectCap, fallback = 99) {
    const normalizedArmorCap = parseOptionalItemNumber(armorCap) ?? fallback;
    const normalizedEffectCap = parseOptionalItemNumber(effectCap);
    return normalizedEffectCap === null
        ? normalizedArmorCap
        : Math.min(normalizedArmorCap, normalizedEffectCap);
}

function firstOptionalNumber(...values) {
    for (const value of values) {
        const parsed = parseOptionalItemNumber(value);
        if (parsed !== null) return parsed;
    }
    return null;
}

function compactOptionalNumbers(values) {
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== null)
    );
}
