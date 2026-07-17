export const combineArmorAndEffectItemAc = (armorItemBonus, effectItemBonus) => {
    const armor = Math.max(0, Number(armorItemBonus) || 0);
    const effect = Math.max(0, Number(effectItemBonus) || 0);
    return {
        effectiveArmorItemBonus: Math.max(armor, effect),
        suppressedEffectItemBonus: effect,
    };
};
