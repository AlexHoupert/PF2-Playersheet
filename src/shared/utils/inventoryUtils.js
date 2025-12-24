import { getShopIndexItemByName } from '../catalog/shopIndex';

/**
 * Determines if an item should stack in the inventory.
 * @param {object} item - The item object to check.
 * @returns {boolean} - True if the item should stack, false otherwise.
 */
export const shouldStack = (item) => {
    const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
    const type = String(item?.type || fromIndex?.type || '').toLowerCase();

    // Fix trait access: Shop Index has it at top level, Inventory items might have it in system
    const indexTraits = fromIndex?.traits?.value || [];
    const itemTraits = item?.traits?.value || item?.system?.traits?.value || [];
    const traits = [...indexTraits, ...itemTraits];

    // Bombs should stack
    if (traits.includes('bomb')) {
        return true;
    }

    // Ammunition should stack
    if (type === 'ammunition' || item.name.includes('Arrow') || item.name.includes('Bolt') || item.name.includes('Dart')) return true;

    // Consumables should stack
    if (['consumable', 'potion', 'scroll', 'oil'].includes(type)) return true;

    // Weapons, Armor, Shields (unless caught above) should NOT stack
    if (['weapon', 'armor', 'shield'].includes(type)) {
        return false;
    }

    // Default to stacking for misc items
    return true;
};
