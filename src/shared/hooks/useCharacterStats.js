import { calculateStat } from '../../shared/utils/rules';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { VIS_CONDS, POS_CONDS, NEG_CONDS } from '../../shared/constants/conditions';

/**
 * Hook for calculating character statistics, AC, and other derived values.
 * Used by both PlayerApp and AdminApp.
 */
export function useCharacterStats(character) {

    const getStat = (key) => calculateStat(character, key);

    const getArmorClassData = () => {
        if (!character) return {};
        const stats = character.stats || {};
        const dex = getStat('dex');

        let dexMod = Math.floor((dex - 10) / 2);
        const level = parseInt(character.level) || 1;

        // Armor Logic
        const inventory = character.inventory || [];

        // Helper to resolve item type from index if missing
        const resolveItem = (item) => {
            const indexItem = item?.name ? getShopIndexItemByName(item.name) : null;
            return {
                ...indexItem,
                ...item,
                system: { ...(indexItem?.system || {}), ...(item.system || {}) },
                category: (item.category || indexItem?.category || '').toLowerCase(),
                type: (item.type || indexItem?.type || '').toLowerCase(),
                acBonus: (item.acBonus ?? indexItem?.acBonus ?? 0),
                dexCap: (item.dexCap ?? indexItem?.dexCap ?? null),
                checkPenalty: (item.checkPenalty ?? indexItem?.checkPenalty ?? 0),
                speedPenalty: (item.speedPenalty ?? indexItem?.speedPenalty ?? 0),
            };
        };

        const armorItems = inventory.filter(i => {
            const r = resolveItem(i);
            return r.type === 'armor' || r.category === 'armor';
        });

        const equippedArmorRaw = armorItems.find(i => i.equipped);
        const equippedArmor = equippedArmorRaw ? resolveItem(equippedArmorRaw) : null;

        // Shield Logic
        const shieldItems = inventory.filter(i => {
            const r = resolveItem(i);
            return r.type === 'shield';
        });
        const equippedShieldRaw = shieldItems.find(i => i.equipped);
        const equippedShield = equippedShieldRaw ? resolveItem(equippedShieldRaw) : null;

        // Base Armor Values
        let armorBonus = 0;
        let dexCap = null;
        let armorName = null;
        let armorCategory = 'unarmored'; // unarmored, light, medium, heavy
        let checkPenalty = 0;
        let speedPenalty = 0;
        let armorItemBonus = 0;

        if (equippedArmor) {
            armorBonus = parseInt(equippedArmor.acBonus) || 0;
            dexCap = (equippedArmor.dexCap !== null && equippedArmor.dexCap !== undefined) ? parseInt(equippedArmor.dexCap) : null;
            armorName = equippedArmor.name;
            armorCategory = equippedArmor.category || 'unarmored';
            checkPenalty = parseInt(equippedArmor.checkPenalty) || 0;
            speedPenalty = parseInt(equippedArmor.speedPenalty) || 0;

            // Check for Potency Runes (simplified logic, usually part of item name or system.runes)
            // For now, assuming item.acBonus includes runes if calculated, or we just take base.
            // In PlayerApp, we used item.acBonus directly.
            armorItemBonus = armorBonus;
        }

        // Apply Dex Cap
        let dexUsed = dexMod;
        if (dexCap !== null && dexUsed > dexCap) {
            dexUsed = dexCap;
        }

        // Proficiency
        const proficiencies = stats.proficiencies || {};
        // Map armor category to proficiency key
        // unarmored -> unarmored
        // light -> light
        // medium -> medium
        // heavy -> heavy
        const profKey = armorCategory;
        const profRank = parseInt(proficiencies[profKey] || 0);
        const profBonus = profRank > 0 ? (profRank + level) : 0; // TEML: 2/4/6/8 + Level. Untrained = 0.

        // Shield Bonus
        let shieldBonus = 0;
        let activeShieldBonus = 0;
        let shieldName = null;

        if (equippedShield) {
            shieldBonus = parseInt(equippedShield.acBonus) || 0; // Usually 1 or 2
            shieldName = equippedShield.name;

            // Shield only gives AC if raised
            if (character.stats?.ac?.shield_raised) {
                activeShieldBonus = shieldBonus;
            }
        }

        // Penalties (Conditions)
        const conditions = character.conditions || [];
        let statusPenalty = 0; // e.g. Frightened, Clumsy
        let circPenalty = 0;

        // Calculate Clumsy (Status penalty to Dex-based checks and AC)
        const clumsy = conditions.find(c => c.name.toLowerCase() === 'clumsy');
        if (clumsy) statusPenalty -= (clumsy.level || 1);

        // Frightened (Status penalty to all checks and DCs) - affects AC
        const frightened = conditions.find(c => c.name.toLowerCase() === 'frightened');
        if (frightened) {
            const val = -(frightened.level || 1);
            if (val < statusPenalty) statusPenalty = val; // Penalties don't stack, take worst
        }

        // Sickened (Status penalty to all checks and DCs) - affects AC
        const sickened = conditions.find(c => c.name.toLowerCase() === 'sickened');
        if (sickened) {
            const val = -(sickened.level || 1);
            if (val < statusPenalty) statusPenalty = val;
        }

        const acPenalty = statusPenalty + circPenalty;

        // Total Calc
        // AC = 10 + Dex (capped) + Proficiency + ArmorItem + Shield (if raised) + Penalties
        // Note: In PF2e, Armor Item Bonus replaces the "10 + Dex" baseline? No.
        // Formula: 10 + Dex(capped) + Prof + Item(Armor) + Item(Shield)

        const baseAC = 10 + dexUsed + profBonus + armorItemBonus + activeShieldBonus;
        const totalAC = baseAC + acPenalty;

        return {
            totalAC,
            baseAC,
            touchAC: 10 + dexUsed + profBonus + acPenalty, // Simplified
            flatFootedAC: totalAC - 2, // Simplified (Circ penalty -2)

            dexMod,
            dexCap,
            dexUsed,

            armorName,
            armorCategory,
            armorItemBonus,
            checkPenalty,
            speedPenalty,

            shieldName,
            shieldBonus,
            activeShieldBonus,
            shieldRaised: !!character.stats?.ac?.shield_raised,
            shieldHp: character.stats?.ac?.shield_hp || 0,

            profKey,
            profRank,
            profBonus,
            level,

            acPenalty,
            statusPenalty,
            circPenalty
        };
    };

    return {
        getStat,
        getArmorClassData
    };
}
