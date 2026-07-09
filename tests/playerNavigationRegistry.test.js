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
import {
    buildPlayerInteractionLockState,
    getAdjacentPlayerSubpageId,
    getSwipeTargetPlayerPageId,
    isPlayerSwipeExcludedTarget,
    shouldCancelPlayerSubpageSwipeForVerticalScroll,
    shouldHandlePlayerSubpageSwipe,
} from '../src/player/navigation/playerSubpageSwipe.js';

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

test('player subpage swipe stays within the active category', () => {
    assert.equal(getAdjacentPlayerSubpageId(PLAYER_PAGE_IDS.STATUS, 'next'), PLAYER_PAGE_IDS.FEATS);
    assert.equal(getAdjacentPlayerSubpageId(PLAYER_PAGE_IDS.FEATS, 'previous'), PLAYER_PAGE_IDS.STATUS);
    assert.equal(getAdjacentPlayerSubpageId(PLAYER_PAGE_IDS.PROFICIENCIES, 'next'), null);
    assert.equal(getAdjacentPlayerSubpageId(PLAYER_PAGE_IDS.QUESTS, 'previous'), null);
    assert.equal(getSwipeTargetPlayerPageId(PLAYER_PAGE_IDS.EQUIPMENT, 80), PLAYER_PAGE_IDS.CONSUMABLES);
    assert.equal(getSwipeTargetPlayerPageId(PLAYER_PAGE_IDS.EQUIPMENT, -80), null);
});

test('player subpage swipe distinguishes horizontal navigation from vertical scroll', () => {
    assert.equal(shouldHandlePlayerSubpageSwipe({ distanceX: 88, distanceY: 20 }), true);
    assert.equal(shouldHandlePlayerSubpageSwipe({ distanceX: 48, distanceY: 2 }), false);
    assert.equal(shouldHandlePlayerSubpageSwipe({ distanceX: 88, distanceY: 76 }), false);
    assert.equal(shouldCancelPlayerSubpageSwipeForVerticalScroll({ distanceX: 12, distanceY: 52 }), true);
    assert.equal(shouldCancelPlayerSubpageSwipeForVerticalScroll({ distanceX: 70, distanceY: 28 }), false);
});

test('player swipe guard excludes controls and modal surfaces', () => {
    const makeTarget = (matches) => ({
        closest: (selector) => Boolean(matches.includes(selector)),
    });

    assert.equal(isPlayerSwipeExcludedTarget(makeTarget(['button'])), true);
    assert.equal(isPlayerSwipeExcludedTarget(makeTarget(['.bottom-sheet'])), true);
    assert.equal(isPlayerSwipeExcludedTarget(makeTarget(['[role="dialog"][aria-modal="true"]'])), true);
    assert.equal(isPlayerSwipeExcludedTarget(makeTarget([])), false);
});

test('player interaction lock covers known overlay states', () => {
    assert.equal(buildPlayerInteractionLockState({}), false);
    assert.equal(buildPlayerInteractionLockState({ modalMode: 'gold' }), true);
    assert.equal(buildPlayerInteractionLockState({ actionModalMode: 'BUY_RESTOCK' }), true);
    assert.equal(buildPlayerInteractionLockState({ catalogMode: 'spell' }), true);
    assert.equal(buildPlayerInteractionLockState({ navDrawerOpen: true }), true);
    assert.equal(buildPlayerInteractionLockState({ dailyPrepCount: 1 }), true);
});
