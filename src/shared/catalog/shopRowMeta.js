function titleCase(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return raw
        .split(/[\s_-]+/g)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatDamage(damage) {
    if (!damage) return '';
    if (typeof damage === 'string') return damage.trim();
    const dice = damage.dice ?? '';
    const die = damage.die ?? '';
    const damageType = damage.damageType ? titleCase(damage.damageType) : '';
    const base = `${dice}${die}`.trim();
    if (!base) return '';
    return damageType ? `${base} ${damageType}` : base;
}

function formatSigned(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    return value >= 0 ? `+${value}` : String(value);
}

export function getShopItemRowMeta(item) {
    const typeLower = String(item?.type || '').toLowerCase();
    const level = typeof item?.level === 'number' ? item.level : null;
    const rarityRaw = item?.rarity || item?.traits?.rarity || '';
    const rarity = rarityRaw ? titleCase(rarityRaw) : '';

    const type = item?.type ? titleCase(item.type) : '';
    const category = item?.category ? titleCase(item.category) : '';
    const group = item?.group ? titleCase(item.group) : '';

    const row1Parts = [];
    if (level !== null) row1Parts.push(`Lvl ${level}`);
    if (rarity) row1Parts.push(rarity);

    if (typeLower === 'weapon' || typeLower === 'armor') {
        if (category) row1Parts.push(category);
        if (group) row1Parts.push(group);
    } else if (typeLower === 'shield') {
        if (type) row1Parts.push(type);
    } else {
        if (type) row1Parts.push(type);
        if (category) row1Parts.push(category);
    }

    const row2Parts = [];
    if (typeLower === 'weapon') {
        const damage = formatDamage(item?.damage);
        if (damage) row2Parts.push(damage);
        const range = typeof item?.range === 'number' && item.range > 0 ? item.range : null;
        if (range !== null) row2Parts.push(`${range}ft`);
    } else if (typeLower === 'armor') {
        if (typeof item?.acBonus === 'number') row2Parts.push(`${formatSigned(item.acBonus)} AC`);
        if (item?.dexCap !== null && item?.dexCap !== undefined) row2Parts.push(`Dex Cap: ${item.dexCap}`);
        if (typeof item?.checkPenalty === 'number' && item.checkPenalty !== 0) row2Parts.push(`Checks: ${item.checkPenalty}`);
        if (typeof item?.speedPenalty === 'number' && item.speedPenalty !== 0) row2Parts.push(`Speed: ${item.speedPenalty}ft`);
        if (typeof item?.strength === 'number' && item.strength > 0) row2Parts.push(`Str: ${item.strength}`);
    } else if (typeLower === 'shield') {
        if (typeof item?.acBonus === 'number') row2Parts.push(`${formatSigned(item.acBonus)} AC`);
        if (typeof item?.hardness === 'number' && item.hardness > 0) row2Parts.push(`Hardness: ${item.hardness}`);

        const hpMax =
            typeof item?.hpMax === 'number'
                ? item.hpMax
                : typeof item?.hp?.max === 'number'
                    ? item.hp.max
                    : null;
        if (hpMax !== null && hpMax > 0) {
            const bt = Math.floor(hpMax / 2);
            row2Parts.push(`HP: ${hpMax}(${bt})`);
        }

        if (typeof item?.speedPenalty === 'number' && item.speedPenalty !== 0) row2Parts.push(`Speed: ${item.speedPenalty}ft`);
    }

    return {
        row1: row1Parts.filter(Boolean).join(' | '),
        row2: row2Parts.filter(Boolean).join(' | ')
    };
}

