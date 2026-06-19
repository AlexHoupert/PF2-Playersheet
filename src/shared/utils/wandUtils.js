const clampInt = (value, min, max) => {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
};

const normalizeTraits = (item) => {
    const raw = item?.system?.traits?.value ?? item?.traits?.value ?? item?.traits ?? [];
    if (Array.isArray(raw)) return raw.map(t => String(t).toLowerCase());
    if (raw && typeof raw === 'object') return Object.values(raw).map(t => String(t).toLowerCase());
    return String(raw || '').split(/[,\s]+/).filter(Boolean).map(t => t.toLowerCase());
};

export const isWandItem = (item) => {
    if (!item) return false;
    const name = String(item.name || item.system?.slug || '').toLowerCase();
    const type = String(item.type || item.category || '').toLowerCase();
    const traits = normalizeTraits(item);
    return Boolean(
        item.system?.wand ||
        traits.includes('wand') ||
        type === 'wand' ||
        /\bwand\b/.test(name)
    );
};

export const getWandSpell = (item) => item?.system?.spell || null;

export const getWandMaxCharges = (item) => {
    const max = Math.trunc(Number(item?.system?.wand?.max));
    return Number.isFinite(max) && max > 0 ? max : 1;
};

export const getWandCharges = (item) => {
    const max = getWandMaxCharges(item);
    if (item?.system?.wand?.charges === undefined || item?.system?.wand?.charges === null) {
        return max;
    }
    return clampInt(item.system.wand.charges, 0, max);
};

export const normalizeWandState = (item) => {
    if (!isWandItem(item)) return item;
    const max = getWandMaxCharges(item);
    const charges = getWandCharges(item);
    return {
        ...item,
        system: {
            ...(item?.system || {}),
            wand: {
                ...(item?.system?.wand || {}),
                max,
                charges
            }
        }
    };
};

export const writeWandCharges = (item, charges) => {
    if (!item) return;
    const max = getWandMaxCharges(item);
    if (!item.system) item.system = {};
    if (!item.system.wand) item.system.wand = {};
    item.system.wand.max = max;
    item.system.wand.charges = clampInt(charges, 0, max);
};

export const rechargeWand = (item) => {
    if (!isWandItem(item)) return;
    writeWandCharges(item, getWandMaxCharges(item));
};

export const consumeWandCharge = (item) => {
    if (!isWandItem(item)) return false;
    const charges = getWandCharges(item);
    if (charges <= 0) {
        writeWandCharges(item, 0);
        return false;
    }
    writeWandCharges(item, charges - 1);
    return true;
};

export const getWandSpellLevel = (spell) => {
    const level = spell?.level ?? spell?.rank ?? spell?.system?.level?.value ?? '1';
    return String(level);
};

export const getWandSpellKey = (spell) => {
    const name = String(spell?.name || '').trim().toLowerCase();
    return `${name}|${getWandSpellLevel(spell)}`;
};

export const getWandSpellCasts = (inventory = []) => {
    const groups = new Map();
    (Array.isArray(inventory) ? inventory : []).forEach((item, index) => {
        if (!isWandItem(item)) return;
        const spell = getWandSpell(item);
        if (!spell?.name) return;

        const level = getWandSpellLevel(spell);
        const key = getWandSpellKey({ ...spell, level });
        const max = getWandMaxCharges(item);
        const charges = getWandCharges(item);
        const normalizedItem = { ...normalizeWandState(item), _index: index };
        const existing = groups.get(key) || {
            key,
            spell: { ...spell, level },
            level,
            available: 0,
            total: 0,
            items: [],
            firstItem: null,
            firstAvailableItem: null
        };

        existing.available += charges;
        existing.total += max;
        existing.items.push(normalizedItem);
        if (!existing.firstItem) existing.firstItem = normalizedItem;
        if (!existing.firstAvailableItem && charges > 0) existing.firstAvailableItem = normalizedItem;
        groups.set(key, existing);
    });

    return Array.from(groups.values()).map(group => ({
        ...group,
        openItem: group.firstAvailableItem || group.firstItem
    }));
};
