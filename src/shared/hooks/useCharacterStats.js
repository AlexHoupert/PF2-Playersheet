import { calculateStat } from '../../utils/rules';
import { getShopIndexItemByName } from '../catalog/shopIndex';

export function useCharacterStats(character) {

    const getArmorClassData = (char) => {
        if (!char) return { totalAC: 10, totalConditionPenalty: 0, shieldRaised: false, shieldName: null };

        const dexMod = Number(char?.stats?.attributes?.dexterity) || 0;
        const level = Math.max(0, Math.trunc(Number(char?.level) || 0));

        const getProfValue = (key) => {
            const profs = char?.stats?.proficiencies; // Hook uses char.stats
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

        // AC Bonus: Priority to 'acBonus' (Legacy/Simple) -> 'system.ac.value' (Foundry) -> 'ac'
        const baseItemAC = Number(equippedArmor?.acBonus ?? equippedArmor?.system?.ac?.value ?? equippedArmor?.ac ?? 0);
        // Potency: System (potencyRune.value) vs old (runes.potency) vs default 0
        const potency = Number(equippedArmor?.system?.potencyRune?.value ?? equippedArmor?.system?.runes?.potency ?? 0);
        const armorItemBonus = baseItemAC + potency;

        const dexCapVal = equippedArmor?.system?.dex_cap ?? equippedArmor?.dexCap;
        const dexCap = (dexCapVal === undefined || dexCapVal === null || dexCapVal === "") ? 99 : Number(dexCapVal);
        const dexUsed = Math.min(dexMod, dexCap);

        const profKey = equippedArmor ? getArmorProfKey(armorCategory) : 'Unarmored';
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
        // Default steel shield has 2 AC bonus usually
        const shieldBase = Number(equippedShield?.system?.ac_bonus ?? equippedShield?.acBonus ?? 2);
        const shieldPotency = Number(equippedShield?.system?.runes?.potency ?? 0);
        const shieldItemBonus = shieldBase + shieldPotency;
        const activeShieldBonus = shieldRaised ? shieldItemBonus : 0;

        const baseAC = 10 + dexUsed + profBonus + armorItemBonus + activeShieldBonus;

        const getCondLevel = (n) => {
            const c = (char?.conditions || []).find(x => String(x?.name || '').toLowerCase() === String(n).toLowerCase());
            return c ? c.level : 0;
        };

        let statusPenalty = 0;
        const frightened = getCondLevel('frightened');
        const clumsy = getCondLevel('clumsy');
        const sickened = getCondLevel('sickened');
        // const drained = getCondLevel('drained'); 

        if (frightened > 0) statusPenalty = Math.min(statusPenalty, -frightened);
        if (clumsy > 0) statusPenalty = Math.min(statusPenalty, -clumsy);
        if (sickened > 0) statusPenalty = Math.min(statusPenalty, -sickened);

        let circPenalty = 0;
        const offGuardSources = ['off-guard', 'prone', 'grabbed', 'restrained', 'paralyzed', 'unconscious', 'blinded'];
        const isOffGuard = (char?.conditions || []).some(c => offGuardSources.includes(String(c?.name || '').toLowerCase()) && c.level > 0);
        if (isOffGuard) circPenalty = -2;

        const acPenalty = statusPenalty + circPenalty;
        const totalAC = baseAC + acPenalty;

        return {
            totalAC,
            baseAC,
            acPenalty,
            // Expose as positive number for UI badge
            totalConditionPenalty: Math.abs(acPenalty),
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
            armorItemBonus
        };
    };

    return {
        getArmorClassData
    };
}
