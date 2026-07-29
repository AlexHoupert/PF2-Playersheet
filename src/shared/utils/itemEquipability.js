const EQUIPABLE_ITEM_TYPES = new Set(['armor', 'shield', 'weapon', 'equipment']);

export function isEquipableItemType(type) {
  return EQUIPABLE_ITEM_TYPES.has(String(type || '').trim().toLowerCase());
}
