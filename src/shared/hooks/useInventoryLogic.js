import { useRef } from 'react';
import { getShopIndexItemByName, fetchShopItemDetailBySourceFile } from '../../shared/catalog/shopIndex';
import { shouldStack } from '../utils/inventoryUtils';

/**
 * Hook for managing inventory operations.
 * Requires `character` (state) and `updateCharacter` (function) from context/props.
 */
export function useInventoryLogic({ character, updateCharacter }) {

    // Helper to resolve complex item types
    const isEquipable = (item) => {
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const type = String(item?.type || fromIndex?.type || '').toLowerCase();
        return ['armor', 'shield', 'weapon'].includes(type);
    };

    /**
     * Consume a consumable item (decrement qty, remove if 0)
     */
    const consumeItem = (item) => {
        updateCharacter(c => {
            const invIdx = c.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (i.name === item.name && i.addedAt === item.addedAt)
            );

            if (invIdx > -1) {
                const invItem = c.inventory[invIdx];
                if (invItem && invItem.qty > 0) {
                    invItem.qty--;
                    if (invItem.qty === 0) c.inventory.splice(invIdx, 1);
                }
            }
        });
    };

    /**
     * Buy an item (deduct gold, add to inventory)
     */
    const buyItem = (item, qty = 1) => {
        updateCharacter(c => {
            const cost = (item.price || 0) * qty;
            if (c.gold >= cost) {
                c.gold = parseFloat((c.gold - cost).toFixed(2));

                // Add item
                const stackable = shouldStack(item);
                const existing = stackable ? c.inventory.find(i => i.name === item.name) : null;

                if (existing) {
                    existing.qty = (existing.qty || 1) + qty;
                    // Merge properties if needed?
                } else {
                    c.inventory.push({ ...item, qty });
                }
            } else {
                alert("Not enough gold!"); // UI should handle this check really
            }
        });
    };

    /**
     * Set explicit quantity
     */
    const updateQty = (item, qty) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (
                    !item.instanceId &&
                    i.name === item.name &&
                    !!i.equipped === !!item.equipped &&
                    !!i.prepared === !!item.prepared &&
                    i.addedAt === item.addedAt
                )
            );

            if (idx > -1) {
                if (qty <= 0) {
                    c.inventory.splice(idx, 1);
                } else {
                    c.inventory[idx].qty = qty;
                }
            }
        });
    };

    /**
     * Split a stack into singles
     */
    const unstackItem = (item) => {
        updateCharacter(c => {
            const target = c.inventory.find(i =>
                i.name === item.name &&
                i.qty === item.qty &&
                i.addedAt === item.addedAt &&
                !!i.equipped === !!item.equipped
            );
            if (target && (target.qty || 1) > 1) {
                const qty = target.qty;
                target.qty = 1;
                for (let k = 1; k < qty; k++) {
                    c.inventory.push({ ...target, qty: 1, instanceId: crypto.randomUUID() });
                }
            }
        });
    };

    /**
     * Toggle Equipped status, handling Armor unequip-others logic and Shield logic
     */
    const toggleEquip = async (targetItem) => {
        const itemName = targetItem?.name || targetItem;
        if (!itemName) return;

        let shieldFetchData = null;

        // Pre-fetch shield data if needed (async part)
        // We do this BEFORE the update closure to avoid async inside reducer pattern if possible,
        // but here updateCharacter expects a synchronous function usually?
        // Wait, PlayerApp passed an async function to updateCharacter? No.
        // PlayerApp fetched data THEN called updateCharacter. We must duplicate that pattern.

        // Resolve item from current state to check type
        const char = character;
        if (!char) return;

        const itemToToggle = typeof targetItem === 'object'
            ? char.inventory.find(i =>
                i.name === itemName &&
                !!i.equipped === !!targetItem.equipped &&
                !!i.prepared === !!targetItem.prepared &&
                i.addedAt === targetItem.addedAt
            )
            : char.inventory.find(i => i.name === itemName);

        if (itemToToggle) {
            const fromIndex = itemToToggle?.name ? getShopIndexItemByName(itemToToggle.name) : null;
            const type = String(itemToToggle?.type || fromIndex?.type || '').toLowerCase();

            if (type === 'shield' && !itemToToggle.equipped && (!itemToToggle.system || !itemToToggle.system.hardness)) {
                const sourceFile = itemToToggle.sourceFile || fromIndex?.sourceFile;
                if (sourceFile) {
                    try {
                        const detail = await fetchShopItemDetailBySourceFile(sourceFile);
                        if (detail) shieldFetchData = detail;
                    } catch (e) {
                        console.error("Failed to fetch shield data", e);
                    }
                }
            }
        }

        updateCharacter(c => {
            // Precise lookup
            const idx = c.inventory.findIndex(i => {
                if (i.name !== itemName) return false;
                if (typeof targetItem === 'object') {
                    return !!i.equipped === !!targetItem.equipped &&
                        !!i.prepared === !!targetItem.prepared &&
                        i.addedAt === targetItem.addedAt;
                }
                return true;
            });

            if (idx === -1) return;
            const current = c.inventory[idx];

            // Check type again inside mutation
            const fromIndex = current?.name ? getShopIndexItemByName(current.name) : null;
            const type = String(current?.type || fromIndex?.type || '').toLowerCase();

            // ARMOR LOGIC
            if (type === 'armor') {
                const nextEquipped = !Boolean(current.equipped);

                if (!c.stats) c.stats = {};
                if (!c.stats.ac) c.stats.ac = {};
                c.stats.ac.last_armor = current.name;

                if (nextEquipped) {
                    // Unequip all other armor
                    c.inventory.forEach(invItem => {
                        const iIdx = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const iType = String(invItem?.type || iIdx?.type || '').toLowerCase();
                        if (iType === 'armor') invItem.equipped = false;
                    });
                    current.equipped = true;
                    c.stats.ac.armor_equipped = true;
                } else {
                    current.equipped = false;
                    // Check if any armor remains
                    const anyArmor = c.inventory.some(invItem => {
                        const iIdx = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const iType = String(invItem?.type || iIdx?.type || '').toLowerCase();
                        return iType === 'armor' && Boolean(invItem.equipped);
                    });
                    c.stats.ac.armor_equipped = anyArmor;
                }
                return;
            }

            // SHIELD LOGIC
            if (type === 'shield') {
                const nextEquipped = !Boolean(current.equipped);

                if (!c.stats) c.stats = {};
                if (!c.stats.ac) c.stats.ac = {};

                if (nextEquipped) {
                    // Unequip other shields
                    c.inventory.forEach(invItem => {
                        const iIdx = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const iType = String(invItem?.type || iIdx?.type || '').toLowerCase();
                        if (iType === 'shield') invItem.equipped = false;
                    });
                    current.equipped = true;

                    // Apply fetched data
                    if (shieldFetchData) {
                        current.system = { ...(current.system || {}), ...shieldFetchData.system };
                    }

                    const itemMax = (current.hpMax) || (current.system?.hp?.max) || (fromIndex?.hpMax) || (shieldFetchData?.hp) || 20;
                    const itemVal = (current.hpValue) || (current.system?.hp?.value) || itemMax;

                    c.stats.ac.shield_hp = itemVal;
                } else {
                    current.equipped = false;
                }
                return;
            }

            // GENERIC STACKABLE LOGIC (Bombs etc)
            if (shouldStack(current)) {
                // Split on Equip
                if (!current.equipped && (current.qty || 1) > 1) {
                    current.qty -= 1;
                    c.inventory.push({ ...current, qty: 1, equipped: true, instanceId: crypto.randomUUID() });
                    return;
                }

                // Merge on Unequip
                if (current.equipped) {
                    const stackTarget = c.inventory.find(i =>
                        i.name === current.name &&
                        !i.equipped &&
                        i !== current &&
                        !!i.prepared === !!current.prepared
                    );
                    if (stackTarget) {
                        stackTarget.qty = (stackTarget.qty || 1) + (current.qty || 1);
                        c.inventory.splice(idx, 1);
                        return;
                    }
                }
            }

            // DEFAULT TOGGLE
            current.equipped = !current.equipped;
        });
    };

    return {
        isEquipable,
        consumeItem,
        buyItem,
        updateQty,
        unstackItem,
        toggleEquip
    };
}
