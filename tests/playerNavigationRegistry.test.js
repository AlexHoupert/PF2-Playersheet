import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getCategoryIdForPlayerPage,
    getLegacyNavigationForPlayerPage,
    getPlayerPageForLegacyNavigation,
    isFuturePlayerPage,
    isPlayerPageCompatibleWithLegacyNavigation,
    PLAYER_NAV_CATEGORIES,
    PLAYER_PAGE_IDS,
} from '../src/player/navigation/playerPageRegistry.js';

test('player navigation registry exposes the five planned mobile categories', () => {
    assert.deepEqual(PLAYER_NAV_CATEGORIES.map((category) => category.id), [
        'character',
        'skills',
        'items',
        'knowledge',
        'campaign',
    ]);
});

test('player navigation registry maps old player tabs to new page ids', () => {
    assert.equal(getPlayerPageForLegacyNavigation('stats', 'character'), PLAYER_PAGE_IDS.STATUS);
    assert.equal(getPlayerPageForLegacyNavigation('magic', 'character'), PLAYER_PAGE_IDS.MAGIC);
    assert.equal(getPlayerPageForLegacyNavigation('shop', 'character'), PLAYER_PAGE_IDS.SHOP);
    assert.equal(getPlayerPageForLegacyNavigation('quests', 'story'), PLAYER_PAGE_IDS.QUESTS);
    assert.equal(getPlayerPageForLegacyNavigation('lore', 'story'), PLAYER_PAGE_IDS.HISTORY);
});

test('player navigation registry maps new pages back to legacy shell targets for phase 2', () => {
    assert.deepEqual(getLegacyNavigationForPlayerPage(PLAYER_PAGE_IDS.STATUS), {
        appMode: 'character',
        activeTab: 'stats',
    });
    assert.deepEqual(getLegacyNavigationForPlayerPage(PLAYER_PAGE_IDS.LOOT), {
        appMode: 'character',
        activeTab: 'items',
    });
    assert.deepEqual(getLegacyNavigationForPlayerPage(PLAYER_PAGE_IDS.CAMP), {
        appMode: 'story',
        activeTab: 'camp',
    });
});

test('player navigation registry keeps future dummy pages explicit and non-legacy', () => {
    assert.equal(isFuturePlayerPage(PLAYER_PAGE_IDS.PROFICIENCIES), true);
    assert.equal(isFuturePlayerPage(PLAYER_PAGE_IDS.EXPLORATION), true);
    assert.equal(isFuturePlayerPage(PLAYER_PAGE_IDS.CRAFTING), true);
    assert.equal(getLegacyNavigationForPlayerPage(PLAYER_PAGE_IDS.CRAFTING), null);
});

test('player navigation registry validates subpage compatibility with legacy state', () => {
    assert.equal(
        isPlayerPageCompatibleWithLegacyNavigation(PLAYER_PAGE_IDS.CONSUMABLES, 'items', 'character'),
        true
    );
    assert.equal(
        isPlayerPageCompatibleWithLegacyNavigation(PLAYER_PAGE_IDS.CONSUMABLES, 'shop', 'character'),
        false
    );
    assert.equal(getCategoryIdForPlayerPage(PLAYER_PAGE_IDS.BESTIARY), 'knowledge');
});
