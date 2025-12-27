import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';

/**
 * Hook for combat-related logic (Weapons, Attacks, Loading).
 */
export function useCombatLogic({ character, updateCharacter }) {

    const getWeaponCapacity = (item) => {
        const traits = (item?.traits?.value || []);
        if (traits.includes('repeating')) return 5;
        if (traits.includes('double-barrel')) return 2;
        if (traits.includes('triple-barrel')) return 3;

        // Capacity-x check
        const capTrait = traits.find(t => t.startsWith('capacity-'));
        if (capTrait) {
            const val = parseInt(capTrait.split('-')[1]);
            return isNaN(val) ? 1 : val;
        }

        return 1;
    };

    /**
     * Calculate Attack Bonus for a weapon.
     * Returns object with total query and breakdown.
     */
    const getWeaponAttackBonus = (item) => {
        if (!character || !item) return 0;

        const grp = (item.group || '').toLowerCase();
        const cat = (item.category || '').toLowerCase(); // Simple, Martial, Advanced
        const traits = (item.traits?.value || []);

        // 1. Proficiency Rank
        // Map raw strings to DB keys if needed
        const profs = character.proficiencies || {};

        const getScore = (key) => profs[key] || profs[key.charAt(0).toUpperCase() + key.slice(1)] || 0;

        // Specific Group Priority
        let groupScore = 0;
        if (grp === 'firearm') groupScore = getScore("Firearms");
        else if (grp === 'crossbow') groupScore = getScore("Crossbows");
        else if (grp === 'bomb') groupScore = getScore("Bombs");
        else if (grp === 'sword') groupScore = getScore("Swords");
        else if (grp === 'bow') groupScore = getScore("Bows");

        // Category Priority
        let catScore = 0;
        if (cat === 'simple') catScore = getScore("Simple");
        else if (cat === 'martial') catScore = getScore("Martial");
        else if (cat === 'advanced') catScore = getScore("Advanced");
        else if (cat === 'unarmed') catScore = getScore("Unarmed");

        const profScore = Math.max(groupScore, catScore);

        // 2. Attribute
        // Ranged (Firearm, Bow, Crossbow, Bomb) -> DEX
        // Melee + Finesse -> Max(STR, DEX)
        // Melee -> STR

        // Attributes might be nested or flat depending on DB schema versions
        // PlayerApp uses character.stats.attributes
        const attr = character.stats?.attributes || {};
        const str = attr.strength || 0;
        const dex = attr.dexterity || 0;

        const isRanged = /ranged|firearm|crossbow|bow|bomb/.test(grp) || traits.includes('thrown');
        const isFinesse = traits.includes('finesse');

        let attrMod = 0;
        if (isRanged) {
            attrMod = dex;
        } else if (isFinesse) {
            attrMod = Math.max(str, dex);
        } else {
            attrMod = str;
        }

        // 3. Level (If Trained+)
        const level = (profScore > 0) ? (parseInt(character.level) || 1) : 0;

        // 4. Item Bonus
        let itemBonus = 0;
        if (item.system?.runes?.potency) itemBonus = item.system.runes.potency;
        else if (item.bonus) itemBonus = item.bonus;
        else if (item.name.includes('+1')) itemBonus = 1;
        else if (item.name.includes('+2')) itemBonus = 2;
        else if (item.name.includes('+3')) itemBonus = 3;

        return {
            total: profScore + level + attrMod + itemBonus,
            breakdown: {
                proficiency: profScore,
                level: level,
                attribute: attrMod,
                item: itemBonus
            },
            source: {
                profRaw: profScore,
                profName: profScore === 2 ? 'Trained' : profScore === 4 ? 'Expert' : profScore === 6 ? 'Master' : profScore === 8 ? 'Legendary' : 'Untrained',
                attrName: isRanged ? 'Dex' : isFinesse && dex > str ? 'Dex (Finesse)' : 'Str',
                levelVal: level
            }
        };
    };

    const loadWeapon = (weaponIndex, slotIndex, ammoItem = null) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w) return;

            if (!w.loaded) w.loaded = [];

            // If explicit ammo not provided, try to find "Rounds (universal)" or best match
            let ammoToLoad = ammoItem;

            if (!ammoToLoad) {
                // Find standard ammo
                // Logic: Look for "Rounds (universal)" (case insensitive) or any item with "rounds" in name and type/category ammo
                const universal = c.inventory.find(i => i.name.toLowerCase() === "rounds (universal)" && i.qty > 0);
                if (universal) {
                    ammoToLoad = universal;
                } else {
                    // Fallback to any "rounds"
                    const compatible = c.inventory.find(i =>
                        i.name.toLowerCase().includes('round') &&
                        i.qty > 0 &&
                        (i.category === 'ammo' || i.type === 'ammunition' || (i.traits?.value || []).includes('ammunition') || i.name.toLowerCase().includes('rounds'))
                    );
                    if (compatible) ammoToLoad = compatible;
                }
            }

            if (!ammoToLoad) {
                alert("No ammunition found!");
                return;
            }

            // Deduct
            const ammoIdx = c.inventory.findIndex(i => (ammoToLoad.instanceId ? i.instanceId === ammoToLoad.instanceId : i.name === ammoToLoad.name) && i.qty > 0);
            if (ammoIdx > -1) {
                const invAmmo = c.inventory[ammoIdx];
                invAmmo.qty--;
                if (invAmmo.qty <= 0) c.inventory.splice(ammoIdx, 1);

                // Load
                const isStandard = /^(rounds \(universal\)|rounds?|bolts?|arrows?)/i.test(ammoToLoad.name);
                w.loaded[slotIndex] = {
                    name: ammoToLoad.name,
                    id: ammoToLoad.instanceId || "std",
                    isSpecial: !isStandard
                };
            } else {
                alert("Ammo not found in inventory.");
            }
        });
    };

    const fireWeapon = (weaponIndex, slotIndex) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded || !w.loaded[slotIndex]) return;
            // Consume ammo (do NOT return to inventory)
            w.loaded[slotIndex] = null;
        });
    };

    const unloadWeapon = (weaponIndex, slotIndex) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded || !w.loaded[slotIndex]) return;
            const ammoData = w.loaded[slotIndex];

            // Return to inventory
            const existingStack = c.inventory.find(i => i.name === ammoData.name);
            if (existingStack) {
                existingStack.qty = (existingStack.qty || 0) + 1;
            } else {
                c.inventory.push({ name: ammoData.name, qty: 1, type: 'consumable', category: 'ammo' });
            }
            w.loaded[slotIndex] = null;
        });
    };

    const unloadAll = (weaponOrIndex) => {
        // Resolve weapon index because mutation generally requires indices for cleanliness, 
        // though `updateCharacter` receives a clone `c` where `findIndex` is fine.

        let targetName = null;
        let targetEquipped = false;
        let targetId = null;

        if (typeof weaponOrIndex === 'object') {
            targetName = weaponOrIndex.name;
            targetEquipped = weaponOrIndex.equipped;
            targetId = weaponOrIndex.instanceId;
        }

        updateCharacter(c => {
            let weaponIndex = -1;
            if (typeof weaponOrIndex === 'number') {
                weaponIndex = weaponOrIndex;
            } else {
                weaponIndex = c.inventory.findIndex(i =>
                    (targetId && i.instanceId === targetId) ||
                    (i.name === targetName && !!i.equipped === !!targetEquipped)
                );
            }

            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded) return;

            w.loaded.forEach(ammoData => {
                if (!ammoData) return;
                const existingStack = c.inventory.find(i => i.name === ammoData.name);
                if (existingStack) {
                    existingStack.qty = (existingStack.qty || 0) + 1;
                } else {
                    c.inventory.push({ name: ammoData.name, qty: 1, type: 'consumable', category: 'ammo' });
                }
            });
            w.loaded = [];
        });
    };

    const loadSpecial = (weaponOrIndex, ammoItem) => {
        const char = character; // Read-only access for resolving index before update logic?

        // We need to resolve which weapon outside of updateCharacter if we want to check capacity first?
        // Actually we can do it inside. But cleaner to do it here.

        // Find weapon in current state to check capacity
        let weapon = null;
        let wIdx = -1;

        if (typeof weaponOrIndex === 'number') {
            wIdx = weaponOrIndex;
            weapon = char.inventory[wIdx];
        } else {
            // Find logic
            wIdx = char.inventory.findIndex(i =>
                (weaponOrIndex.instanceId && i.instanceId === weaponOrIndex.instanceId) ||
                (i.name === weaponOrIndex.name && !!i.equipped === !!weaponOrIndex.equipped)
            );
            weapon = char.inventory[wIdx];
        }

        if (!weapon) return;

        const fromIndex = getShopIndexItemByName(weapon.name);
        const merged = fromIndex ? { ...fromIndex, ...weapon } : weapon;
        const capacity = getWeaponCapacity(merged);
        const currentLoaded = weapon.loaded || [];

        let emptySlot = -1;
        for (let i = 0; i < capacity; i++) {
            if (!currentLoaded[i]) {
                emptySlot = i;
                break;
            }
        }

        if (emptySlot === -1) {
            alert("Weapon is full!");
            return;
        }

        // Use internal loadWeapon or just reuse logic?
        // reuse loadWeapon
        loadWeapon(wIdx, emptySlot, ammoItem);
    };

    return {
        getWeaponCapacity,
        getWeaponAttackBonus,
        loadWeapon,
        fireWeapon,
        unloadWeapon,
        unloadAll,
        loadSpecial
    };
}
