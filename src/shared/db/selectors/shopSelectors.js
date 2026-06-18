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
