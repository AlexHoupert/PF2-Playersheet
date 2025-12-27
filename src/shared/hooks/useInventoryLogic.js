import { shouldStack } from '../utils/inventoryUtils';
import { getShopIndexItemByName } from '../catalog/shopIndex';

export function useInventoryLogic({ character, updateCharacter }) {

    const toggleEquip = (item) => {
        updateCharacter(c => {
            const i = c.inventory.find(x => x.name === item.name && x.instanceId === item.instanceId);
            if (i) {
                // If equipping, check for conflicts
                if (!i.equipped) {
                    // Logic to unequip other items in same slot if needed (e.g. Armor)
                    if (isArmor(i)) {
                        c.inventory.forEach(x => {
                            if (x.equipped && isArmor(x) && x !== i) x.equipped = false;
                        });
                    }
                    // Shield logic: only one shield?
                    if (isShield(i)) {
                        c.inventory.forEach(x => {
                            if (x.equipped && isShield(x) && x !== i) x.equipped = false;
                        });
                        // Update AC stats
                        if (!c.stats.ac) c.stats.ac = {};
                        c.stats.ac.shield_name = i.name;
                    }
                } else {
                    // Unequipping
                    if (isShield(i)) {
                        if (c.stats.ac?.shield_name === i.name) {
                            c.stats.ac.shield_name = null;
                            c.stats.ac.shield_raised = false;
                        }
                    }
                }
                i.equipped = !i.equipped;
            }
        });
    };

    const isArmor = (item) => (item.type || '').toLowerCase() === 'armor' || (item.category || '').toLowerCase() === 'armor';
    const isShield = (item) => (item.type || '').toLowerCase() === 'shield' || (item.category || '').toLowerCase() === 'shield';
    const isEquipable = (item) => {
        const type = (item.type || '').toLowerCase();
        return type === 'weapon' || type === 'armor' || type === 'shield' || ((item.usage || '').includes('worn'));
    };

    return {
        toggleEquip,
        isEquipable
    };
}
