const normalizeName = (value) => String(value || '').trim().toLowerCase();

export const hasScalySkinFeat = (char) => {
    const feats = Array.isArray(char?.feats) ? char.feats : [];
    return feats.some(feat => {
        const name = normalizeName(typeof feat === 'string' ? feat : feat?.name);
        return name === 'scaly skin' || name === 'scaly hide' || name.includes('scaly skin');
    });
};

export const isUnarmoredClothing = (armor, profKey) => {
    if (!armor) return true;
    const name = normalizeName(armor.name);
    const category = normalizeName(armor.category || armor.system?.category || armor.system?.group?.value);
    return profKey === 'Unarmored'
        || category === 'unarmored'
        || name === "explorer's clothing"
        || name === 'explorers clothing';
};

export const getScalySkinAcAdjustment = ({ character, equippedArmor, profKey, level, armorDexCap }) => {
    const active = hasScalySkinFeat(character) && isUnarmoredClothing(equippedArmor, profKey);
    const bonus = active ? (Math.max(0, Math.trunc(Number(level) || 0)) >= 5 ? 2 : 1) : 0;
    const baseDexCap = Number.isFinite(Number(armorDexCap)) ? Number(armorDexCap) : 99;

    return {
        active,
        bonus,
        dexCap: active ? Math.min(baseDexCap, 3) : baseDexCap
    };
};
