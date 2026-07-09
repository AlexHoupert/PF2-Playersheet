export const PLAYER_CATEGORY_IDS = {
    CHARACTER: 'character',
    SKILLS: 'skills',
    ITEMS: 'items',
    KNOWLEDGE: 'knowledge',
    CAMPAIGN: 'campaign',
};

export const PLAYER_PAGE_IDS = {
    STATUS: 'character.status',
    FEATS: 'character.feats',
    MAGIC: 'character.magic',
    IMPULSES: 'character.impulses',
    PACT: 'character.pact',
    COMPANION: 'character.owned-actor',
    PROFICIENCIES: 'character.proficiencies',
    COMBAT: 'skills.combat',
    MOVEMENT: 'skills.movement',
    GENERAL: 'skills.general',
    DOWNTIME: 'skills.downtime',
    EXPLORATION: 'skills.exploration',
    CAMPING_SKILLS: 'skills.camping',
    EQUIPMENT: 'items.equipment',
    CONSUMABLES: 'items.consumables',
    MISC: 'items.misc',
    SHOP: 'items.shop',
    CRAFTING: 'items.crafting',
    LOOT: 'items.loot',
    HISTORY: 'knowledge.history',
    LOCATIONS: 'knowledge.locations',
    NPCS: 'knowledge.npcs',
    BESTIARY: 'knowledge.bestiary',
    OTHER: 'knowledge.other',
    QUESTS: 'campaign.quests',
    PROGRESS: 'campaign.progress',
    MAPS: 'campaign.maps',
    CAMP: 'campaign.camp',
};

export const PLAYER_NAV_CATEGORIES = [
    {
        id: PLAYER_CATEGORY_IDS.CHARACTER,
        label: 'Character',
        icon: 'skills',
        pages: [
            { id: PLAYER_PAGE_IDS.STATUS, label: 'Status', legacyTab: 'stats', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.FEATS, label: 'Feats', legacyTab: 'feats', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.MAGIC, label: 'Magic', legacyTab: 'magic', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.IMPULSES, label: 'Impulses', legacyTab: 'impulses', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.PACT, label: 'Pact', legacyTab: 'pact', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.COMPANION, label: 'Companion', legacyTab: 'companion', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.PROFICIENCIES, label: 'Proficiencies', future: true },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.SKILLS,
        label: 'Skills',
        icon: 'dice-twenty-faces-twenty',
        pages: [
            { id: PLAYER_PAGE_IDS.COMBAT, label: 'Combat', legacyTab: 'actions', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.MOVEMENT, label: 'Movement', legacyTab: 'actions', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.GENERAL, label: 'General', legacyTab: 'actions', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.DOWNTIME, label: 'Downtime', legacyTab: 'actions', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.EXPLORATION, label: 'Exploration', future: true },
            { id: PLAYER_PAGE_IDS.CAMPING_SKILLS, label: 'Camping', legacyTab: 'actions', legacyMode: 'character' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.ITEMS,
        label: 'Items',
        icon: 'drink-me',
        pages: [
            { id: PLAYER_PAGE_IDS.EQUIPMENT, label: 'Equipment', legacyTab: 'items', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.CONSUMABLES, label: 'Consumables', legacyTab: 'items', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.MISC, label: 'Misc.', legacyTab: 'items', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.SHOP, label: 'Shop', legacyTab: 'shop', legacyMode: 'character' },
            { id: PLAYER_PAGE_IDS.CRAFTING, label: 'Crafting', future: true },
            { id: PLAYER_PAGE_IDS.LOOT, label: 'Loot', legacyTab: 'items', legacyMode: 'character', alertKey: 'loot' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.KNOWLEDGE,
        label: 'Knowledge',
        icon: 'bookmarklet',
        pages: [
            { id: PLAYER_PAGE_IDS.HISTORY, label: 'History', legacyTab: 'lore', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.LOCATIONS, label: 'Locations', legacyTab: 'lore', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.NPCS, label: 'NPCs', legacyTab: 'lore', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.BESTIARY, label: 'Bestiary', legacyTab: 'lore', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.OTHER, label: 'Other', legacyTab: 'lore', legacyMode: 'story' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.CAMPAIGN,
        label: 'Campaign',
        icon: 'treasure-map',
        pages: [
            { id: PLAYER_PAGE_IDS.QUESTS, label: 'Quests', legacyTab: 'quests', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.PROGRESS, label: 'Progress', legacyTab: 'progress', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.MAPS, label: 'Maps', legacyTab: 'maps', legacyMode: 'story' },
            { id: PLAYER_PAGE_IDS.CAMP, label: 'Camp', legacyTab: 'camp', legacyMode: 'story' },
        ],
    },
];

const PAGE_BY_ID = new Map(
    PLAYER_NAV_CATEGORIES.flatMap((category) =>
        category.pages.map((page) => [page.id, { ...page, categoryId: category.id }])
    )
);

const CATEGORY_BY_ID = new Map(PLAYER_NAV_CATEGORIES.map((category) => [category.id, category]));

export function getPlayerCategory(categoryId) {
    return CATEGORY_BY_ID.get(categoryId) || null;
}

export function getPlayerPage(pageId) {
    return PAGE_BY_ID.get(pageId) || null;
}

export function getDefaultPageForCategory(categoryId) {
    const category = getPlayerCategory(categoryId);
    return category?.pages?.[0] || null;
}

export function getPlayerPageForLegacyNavigation(activeTab, appMode) {
    const mode = appMode || inferModeForLegacyTab(activeTab);
    if (mode === 'story') {
        if (activeTab === 'quests') return PLAYER_PAGE_IDS.QUESTS;
        if (activeTab === 'progress') return PLAYER_PAGE_IDS.PROGRESS;
        if (activeTab === 'maps') return PLAYER_PAGE_IDS.MAPS;
        if (activeTab === 'camp') return PLAYER_PAGE_IDS.CAMP;
        if (activeTab === 'lore') return PLAYER_PAGE_IDS.HISTORY;
    }

    if (activeTab === 'actions') return PLAYER_PAGE_IDS.COMBAT;
    if (activeTab === 'feats') return PLAYER_PAGE_IDS.FEATS;
    if (activeTab === 'magic') return PLAYER_PAGE_IDS.MAGIC;
    if (activeTab === 'impulses') return PLAYER_PAGE_IDS.IMPULSES;
    if (activeTab === 'pact') return PLAYER_PAGE_IDS.PACT;
    if (activeTab === 'companion') return PLAYER_PAGE_IDS.COMPANION;
    if (activeTab === 'items') return PLAYER_PAGE_IDS.EQUIPMENT;
    if (activeTab === 'shop') return PLAYER_PAGE_IDS.SHOP;
    return PLAYER_PAGE_IDS.STATUS;
}

export function getLegacyNavigationForPlayerPage(pageId) {
    const page = getPlayerPage(pageId);
    if (!page || page.future || !page.legacyTab) return null;
    return {
        appMode: page.legacyMode || inferModeForLegacyTab(page.legacyTab),
        activeTab: page.legacyTab,
    };
}

export function isPlayerPageCompatibleWithLegacyNavigation(pageId, activeTab, appMode) {
    const target = getLegacyNavigationForPlayerPage(pageId);
    if (!target) return false;
    return target.activeTab === activeTab && target.appMode === (appMode || inferModeForLegacyTab(activeTab));
}

export function getCategoryIdForPlayerPage(pageId) {
    return getPlayerPage(pageId)?.categoryId || PLAYER_CATEGORY_IDS.CHARACTER;
}

export function isFuturePlayerPage(pageId) {
    return Boolean(getPlayerPage(pageId)?.future);
}

function inferModeForLegacyTab(activeTab) {
    return ['quests', 'lore', 'maps', 'progress', 'camp'].includes(activeTab) ? 'story' : 'character';
}
