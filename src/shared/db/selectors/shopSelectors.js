export function selectShop(db) {
    return {
        availableItems: Array.isArray(db?.shop?.availableItems) ? db.shop.availableItems : [],
        availableFormulas: Array.isArray(db?.shop?.availableFormulas) ? db.shop.availableFormulas : [],
        traders: Array.isArray(db?.shop?.traders) ? db.shop.traders : [],
        customItems: db?.shop?.customItems || {},
    };
}

export function selectVisibleTraders(db) {
    return selectShop(db).traders.filter((trader) => !trader.hidden);
}

export function selectCustomShopItem(db, itemName) {
    return itemName ? selectShop(db).customItems[itemName] || null : null;
}

export function selectAvailableItemNames(db) {
    return selectShop(db).availableItems;
}

export function selectAvailableFormulaNames(db) {
    return selectShop(db).availableFormulas;
}

export function selectShopTraders(db) {
    return selectShop(db).traders;
}
