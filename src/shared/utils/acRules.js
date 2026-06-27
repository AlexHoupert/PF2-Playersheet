import { resolveEffectModifiers } from '../rules/effectResolver.js';

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
    const baseDexCap = Number.isFinite(Number(armorDexCap)) ? Number(armorDexCap) : 99;
    const effect = createScalySkinEffect({ active, level });
    const acModifiers = resolveEffectModifiers(effect ? [effect] : [], 'ac');
    const dexCapModifiers = resolveEffectModifiers(effect ? [effect] : [], 'ac.dex_cap');
    const bonus = acModifiers.breakdown.item || 0;
    const effectDexCap = dexCapModifiers.cap;

    return {
        active,
        bonus,
        dexCap: active && Number.isFinite(Number(effectDexCap)) ? Math.min(baseDexCap, effectDexCap) : baseDexCap,
        effect,
    };
};

export const combineArmorAndEffectItemAc = (armorItemBonus, effectItemBonus) => {
    const armor = Math.max(0, Number(armorItemBonus) || 0);
    const effect = Math.max(0, Number(effectItemBonus) || 0);
    return {
        effectiveArmorItemBonus: Math.max(armor, effect),
        suppressedEffectItemBonus: effect,
    };
};

export function createScalySkinEffect({ active, level }) {
    if (!active) return null;
    const bonus = Math.max(0, Math.trunc(Number(level) || 0)) >= 5 ? 2 : 1;
    return {
        id: 'feat_scaly_skin_ac',
        label: 'Scaly Skin',
        category: 'feat',
        modifiers: [
            {
                selector: 'ac',
                mode: 'bonus',
                bonusType: 'item',
                value: bonus,
                stackingKey: 'scaly_skin_ac',
                dependencyKey: 'ac.item',
            },
            {
                selector: 'ac.dex_cap',
                mode: 'cap',
                value: 3,
                stackingKey: 'scaly_skin_dex_cap',
                dependencyKey: 'ac.dex_cap',
            },
        ],
    };
}
