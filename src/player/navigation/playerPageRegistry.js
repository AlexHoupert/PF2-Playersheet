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
            { id: PLAYER_PAGE_IDS.STATUS, label: 'Status', legacyTab: 'stats', legacyMode: 'character', icon: 'heart-beats' },
            { id: PLAYER_PAGE_IDS.FEATS, label: 'Feats', legacyTab: 'feats', legacyMode: 'character', icon: 'laurels-trophy' },
            { id: PLAYER_PAGE_IDS.MAGIC, label: 'Magic', legacyTab: 'magic', legacyMode: 'character', icon: 'magic-swirl', requires: 'magic' },
            { id: PLAYER_PAGE_IDS.IMPULSES, label: 'Impulses', legacyTab: 'impulses', legacyMode: 'character', icon: 'lightning-arc', requires: 'impulses' },
            { id: PLAYER_PAGE_IDS.PACT, label: 'Pact', legacyTab: 'pact', legacyMode: 'character', icon: 'shaking-hands' },
            { id: PLAYER_PAGE_IDS.COMPANION, label: 'Companion', legacyTab: 'companion', legacyMode: 'character', icon: 'wolf-head', requires: 'companion' },
            { id: PLAYER_PAGE_IDS.PROFICIENCIES, label: 'Proficiencies', future: true, icon: 'crossed-swords' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.SKILLS,
        label: 'Skills',
        icon: 'dice-twenty-faces-twenty',
        pages: [
            { id: PLAYER_PAGE_IDS.COMBAT, label: 'Combat', legacyTab: 'actions', legacyMode: 'character', icon: 'crossed-swords' },
            { id: PLAYER_PAGE_IDS.MOVEMENT, label: 'Movement', legacyTab: 'actions', legacyMode: 'character', icon: 'running-shoe' },
            { id: PLAYER_PAGE_IDS.GENERAL, label: 'General', legacyTab: 'actions', legacyMode: 'character', icon: 'skills' },
            { id: PLAYER_PAGE_IDS.DOWNTIME, label: 'Downtime', legacyTab: 'actions', legacyMode: 'character', icon: 'hourglass' },
            { id: PLAYER_PAGE_IDS.EXPLORATION, label: 'Exploration', future: true, icon: 'compass' },
            { id: PLAYER_PAGE_IDS.CAMPING_SKILLS, label: 'Camping', legacyTab: 'actions', legacyMode: 'character', icon: 'campfire' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.ITEMS,
        label: 'Items',
        icon: 'drink-me',
        pages: [
            { id: PLAYER_PAGE_IDS.EQUIPMENT, label: 'Equipment', legacyTab: 'items', legacyMode: 'character', icon: 'backpack' },
            { id: PLAYER_PAGE_IDS.CONSUMABLES, label: 'Consumables', legacyTab: 'items', legacyMode: 'character', icon: 'potion-ball' },
            { id: PLAYER_PAGE_IDS.MISC, label: 'Misc.', legacyTab: 'items', legacyMode: 'character', icon: 'swap-bag' },
            { id: PLAYER_PAGE_IDS.SHOP, label: 'Shop', legacyTab: 'shop', legacyMode: 'character', icon: 'cash' },
            { id: PLAYER_PAGE_IDS.CRAFTING, label: 'Crafting', future: true, icon: 'hammer-nails' },
            { id: PLAYER_PAGE_IDS.LOOT, label: 'Loot', legacyTab: 'items', legacyMode: 'character', alertKey: 'loot', icon: 'locked-chest' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.KNOWLEDGE,
        label: 'Knowledge',
        icon: 'bookmarklet',
        pages: [
            { id: PLAYER_PAGE_IDS.HISTORY, label: 'History', legacyTab: 'lore', legacyMode: 'story', icon: 'scroll-quill' },
            { id: PLAYER_PAGE_IDS.LOCATIONS, label: 'Locations', legacyTab: 'lore', legacyMode: 'story', icon: 'world' },
            { id: PLAYER_PAGE_IDS.NPCS, label: 'NPCs', legacyTab: 'lore', legacyMode: 'story', icon: 'cloak-dagger' },
            { id: PLAYER_PAGE_IDS.BESTIARY, label: 'Bestiary', legacyTab: 'lore', legacyMode: 'story', icon: 'monster-grasp' },
            { id: PLAYER_PAGE_IDS.OTHER, label: 'Other', legacyTab: 'lore', legacyMode: 'story', icon: 'bookshelf' },
        ],
    },
    {
        id: PLAYER_CATEGORY_IDS.CAMPAIGN,
        label: 'Campaign',
        icon: 'treasure-map',
        pages: [
            { id: PLAYER_PAGE_IDS.QUESTS, label: 'Quests', legacyTab: 'quests', legacyMode: 'story', icon: 'rolled-cloth' },
            { id: PLAYER_PAGE_IDS.PROGRESS, label: 'Progress', legacyTab: 'progress', legacyMode: 'story', icon: 'progression' },
            { id: PLAYER_PAGE_IDS.MAPS, label: 'Maps', legacyTab: 'maps', legacyMode: 'story', icon: 'treasure-map' },
            { id: PLAYER_PAGE_IDS.CAMP, label: 'Camp', legacyTab: 'camp', legacyMode: 'story', icon: 'campfire' },
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

export function getVisiblePlayerNavCategories(navigationContext = {}) {
    const capabilities = normalizeNavigationCapabilities(navigationContext);
    return PLAYER_NAV_CATEGORIES
        .map((category) => ({
            ...category,
            pages: category.pages.filter((page) => isPlayerPageVisible(page, capabilities)),
        }))
        .filter((category) => category.pages.length > 0);
}

export function getVisiblePlayerCategory(categoryId, navigationContext = {}) {
    return getVisiblePlayerNavCategories(navigationContext).find((category) => category.id === categoryId) || null;
}

export function getPlayerPage(pageId) {
    return PAGE_BY_ID.get(pageId) || null;
}

export function getVisiblePlayerPage(pageId, navigationContext = {}) {
    const page = getPlayerPage(pageId);
    if (!page) return null;
    return isPlayerPageVisible(page, normalizeNavigationCapabilities(navigationContext)) ? page : null;
}

export function getDefaultPageForCategory(categoryId) {
    const category = getPlayerCategory(categoryId);
    return category?.pages?.[0] || null;
}

export function getDefaultVisiblePageForCategory(categoryId, navigationContext = {}) {
    const category = getVisiblePlayerCategory(categoryId, navigationContext);
    return category?.pages?.[0] || null;
}

export function getVisiblePlayerPageId(pageId, navigationContext = {}) {
    const requestedPage = getVisiblePlayerPage(pageId, navigationContext);
    if (requestedPage) return requestedPage.id;

    const staticPage = getPlayerPage(pageId);
    const sameCategoryDefault = staticPage
        ? getDefaultVisiblePageForCategory(staticPage.categoryId, navigationContext)
        : null;
    if (sameCategoryDefault) return sameCategoryDefault.id;

    return getVisiblePlayerNavCategories(navigationContext)[0]?.pages?.[0]?.id || PLAYER_PAGE_IDS.STATUS;
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

export function getPlayerSubpageCarouselItems(pageId, radius = 2) {
    const page = getPlayerPage(pageId);
    const category = getPlayerCategory(page?.categoryId);
    const pages = category?.pages || [];
    if (!page || pages.length === 0) return [];

    const activeIndex = pages.findIndex((entry) => entry.id === page.id);
    if (activeIndex === -1) return [];

    const seen = new Set();
    const items = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
        const index = wrapIndex(activeIndex + offset, pages.length);
        const entry = pages[index];
        if (!entry || seen.has(entry.id)) continue;
        seen.add(entry.id);
        items.push({
            page: entry,
            offset,
            state: offset === 0 ? 'active' : Math.abs(offset) === 1 ? 'neighbor' : 'edge',
        });
    }
    return items;
}

export function isFuturePlayerPage(pageId) {
    return Boolean(getPlayerPage(pageId)?.future);
}

export function buildPlayerNavigationContext({ character, ownedCompanionActors } = {}) {
    return {
        hasMagic: characterHasMagic(character),
        hasImpulses: characterHasImpulses(character),
        hasCompanion: characterHasCompanion(character, ownedCompanionActors),
    };
}

export function characterHasMagic(character) {
    if (!character) return false;
    if (character.isCaster) return true;
    if ((character.magic?.list || []).length > 0) return true;
    if (Number(character.stats?.spell_proficiency || 0) > 0) return true;

    const slots = character.magic?.slots || {};
    return Object.entries(slots).some(([key, value]) =>
        String(key).endsWith('_max') && Number(value || 0) > 0
    );
}

export function characterHasImpulses(character) {
    if (!character) return false;
    if (character.isKineticist) return true;
    if ((character.impulses || []).length > 0) return true;
    return Number(character.stats?.impulse_proficiency || 0) > 0;
}

export function characterHasCompanion(character, ownedCompanionActors = []) {
    if ((ownedCompanionActors || []).length > 0) return true;
    if (character?.has_companion) return true;
    return Boolean(character?.companion);
}

function wrapIndex(index, length) {
    return ((index % length) + length) % length;
}

function inferModeForLegacyTab(activeTab) {
    return ['quests', 'lore', 'maps', 'progress', 'camp'].includes(activeTab) ? 'story' : 'character';
}

function normalizeNavigationCapabilities(navigationContext = {}) {
    if (
        Object.prototype.hasOwnProperty.call(navigationContext, 'hasMagic') ||
        Object.prototype.hasOwnProperty.call(navigationContext, 'hasImpulses') ||
        Object.prototype.hasOwnProperty.call(navigationContext, 'hasCompanion')
    ) {
        return {
            hasMagic: Boolean(navigationContext.hasMagic),
            hasImpulses: Boolean(navigationContext.hasImpulses),
            hasCompanion: Boolean(navigationContext.hasCompanion),
        };
    }

    return {
        hasMagic: true,
        hasImpulses: true,
        hasCompanion: true,
    };
}

function isPlayerPageVisible(page, capabilities) {
    if (!page?.requires) return true;
    if (page.requires === 'magic') return capabilities.hasMagic;
    if (page.requires === 'impulses') return capabilities.hasImpulses;
    if (page.requires === 'companion') return capabilities.hasCompanion;
    return true;
}
