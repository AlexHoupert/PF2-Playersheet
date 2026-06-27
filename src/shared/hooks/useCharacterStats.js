import { getConditionEffects } from '../../utils/rules.js';
import { getShopIndexItemByName } from '../catalog/shopIndex.js';
import { combineArmorAndEffectItemAc, getScalySkinAcAdjustment } from '../utils/acRules.js';

export const getArmorClassData = (char) => {
    if (!char) return { totalAC: 10, totalConditionPenalty: 0, shieldRaised: false, shieldName: null };

    const dexMod = Number(char?.stats?.attributes?.dexterity) || 0;
    const level = Math.max(0, Math.trunc(Number(char?.level) || 0));

    const getProfValue = (key) => {
        const profs = char?.stats?.proficiencies;
        if (profs && typeof profs === 'object' && !Array.isArray(profs)) {
            const k = String(key).toLowerCase();
            const val = profs[k] || profs[key];
            const num = Number(val);
            return Number.isFinite(num) ? num : 0;
        }
        if (Array.isArray(profs)) {
            const found = profs.find(p => String(p?.name || '').toLowerCase() === String(key).toLowerCase());
            const num = Number(found?.prof);
            return Number.isFinite(num) ? num : 0;
        }
        return 0;
    };

    const getArmorProfKey = (category) => {
        const cat = String(category || '').toLowerCase();
        if (cat.startsWith('light')) return 'Light';
        if (cat.startsWith('medium')) return 'Medium';
        if (cat.startsWith('heavy')) return 'Heavy';
        return 'Unarmored';
    };

    const inventory = Array.isArray(char?.inventory) ? char.inventory : [];
    const equippedArmorEntry = inventory.find(invItem => {
        if (!invItem?.equipped) return false;
        const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
        const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
        const cat = String(invItem?.category || fromIndex?.category || '').toLowerCase();
        return type === 'armor' || cat.includes('armor');
    });

    let equippedArmor = null;
    if (equippedArmorEntry) {
        const fromIndex = getShopIndexItemByName(equippedArmorEntry.name);
        equippedArmor = fromIndex ? { ...fromIndex, ...equippedArmorEntry } : equippedArmorEntry;
    }

    const armorCategory = equippedArmor?.category || null;
    const profKey = equippedArmor ? getArmorProfKey(armorCategory) : 'Unarmored';

    // AC Bonus
    const baseItemAC = Number(equippedArmor?.acBonus ?? equippedArmor?.system?.ac?.value ?? equippedArmor?.ac ?? 0);
    const potency = Number(equippedArmor?.system?.potencyRune?.value ?? equippedArmor?.system?.runes?.potency ?? 0);

    const dexCapVal = equippedArmor?.system?.dex_cap ?? equippedArmor?.dexCap;
    const armorDexCap = (dexCapVal === undefined || dexCapVal === null || dexCapVal === "") ? 99 : Number(dexCapVal);
    const scalySkin = getScalySkinAcAdjustment({ character: char, equippedArmor, profKey, level, armorDexCap });
    const scalySkinActive = scalySkin.active;
    const scalySkinBonus = scalySkin.bonus;
    const armorItemBonus = baseItemAC + potency + scalySkinBonus;
    const dexCap = scalySkin.dexCap;
    const dexUsed = Math.min(dexMod, dexCap);

    const profRank = getProfValue(profKey);
    const profBonus = profRank > 0 ? profRank + level : 0;

    // Shield Logic
    const equippedShieldEntry = inventory.find(invItem => {
        if (!invItem?.equipped) return false;
        const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
        const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
        const cat = String(invItem?.category || fromIndex?.category || '').toLowerCase();
        return type === 'shield' || cat.includes('shield');
    });

    let equippedShield = null;
    if (equippedShieldEntry) {
        const fromIndex = getShopIndexItemByName(equippedShieldEntry.name) || {};
        equippedShield = { ...fromIndex, ...equippedShieldEntry };
    }

    const shieldRaised = Boolean(char.stats?.ac?.shield_raised);
    const shieldBase = Number(equippedShield?.system?.ac_bonus ?? equippedShield?.acBonus ?? 2);
    const shieldPotency = Number(equippedShield?.system?.runes?.potency ?? 0);
    const shieldItemBonus = shieldBase + shieldPotency;
    const activeShieldBonus = shieldRaised ? shieldItemBonus : 0;

    const baseACWithoutArmorItem = 10 + dexUsed + profBonus + activeShieldBonus;

    // Calculate Condition Effects (Status/Circ/Item from Mutagens)
    // Note: Mutagen Item modifiers will separate here. Ideally separate Item vs Status.
    // getConditionEffects handles Stacking (Max Bonus + Min Penalty).
    // If we have Mutagen (+2 Item AC), it should theoretically not stack with Armor (+Item AC).
    // But Mutagens usually give Item Penalties (stacking issues irrelevant) or Item Bonuses (e.g. Drakeheart).
    // The current rules engine doesn't know about `armorItemBonus`.
    // We accept `condEffects.total` as the condition-based modifier.
    const condEffects = getConditionEffects(char, "AC", "Dexterity");
    const effectItemBonus = Math.max(0, Number(condEffects.itemBonus) || 0);
    const { effectiveArmorItemBonus, suppressedEffectItemBonus } = combineArmorAndEffectItemAc(armorItemBonus, effectItemBonus);
    const acAdjustmentWithoutStackedItemBonus = condEffects.total - suppressedEffectItemBonus;
    const baseAC = baseACWithoutArmorItem + effectiveArmorItemBonus;
    const acPenalty = acAdjustmentWithoutStackedItemBonus;
    const totalAC = baseAC + acPenalty;

    return {
        totalAC,
        baseAC,
        acPenalty,
        totalConditionPenalty: acPenalty < 0 ? Math.abs(acPenalty) : 0,
        acBonus: acPenalty > 0 ? acPenalty : 0,
        shieldRaised,
        shieldName: equippedShield?.name || null,
        shieldItemBonus,
        activeShieldBonus,
        dexMod,
        dexCap,
        dexUsed,
        profKey,
        profRank,
        level,
        profBonus,
        armorName: equippedArmor?.name || null,
        armorCategory,
        armorItemBonus,
        effectiveArmorItemBonus,
        effectItemBonus,
        baseItemAC,
        potency,
        scalySkinActive,
        scalySkinBonus,
        equippedShield
    };
};

export function useCharacterStats(character) {
    return {
        getArmorClassData
    };
}
