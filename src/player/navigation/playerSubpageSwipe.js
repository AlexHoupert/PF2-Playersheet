import {
    getCategoryIdForPlayerPage,
    getPlayerCategory,
    getPlayerPage,
} from './playerPageRegistry.js';

export const PLAYER_SWIPE_THRESHOLD = 108;
export const PLAYER_SWIPE_HORIZONTAL_RATIO = 1.35;
export const PLAYER_SWIPE_VERTICAL_CANCEL_RATIO = 1.1;

export const PLAYER_SWIPE_EXCLUDE_SELECTORS = [
    '.no-swipe',
    '.modal-overlay',
    '.bottom-sheet',
    '.bottom-sheet-backdrop',
    '.item-catalog-overlay',
    '.player-category-drawer',
    '.player-bottom-nav-root',
    '[role="dialog"][aria-modal="true"]',
    '[data-player-interaction-lock="true"]',
    '[data-slot="dialog-content"]',
    '[data-slot="drawer-content"]',
    '[contenteditable="true"]',
    'input',
    'textarea',
    'select',
    'button',
    'a',
];

export function getPlayerSubpagesForActivePage(pageId) {
    const categoryId = getCategoryIdForPlayerPage(pageId);
    return getPlayerCategory(categoryId)?.pages || [];
}

export function getAdjacentPlayerSubpageId(pageId, direction) {
    if (!getPlayerPage(pageId)) return null;
    const pages = getPlayerSubpagesForActivePage(pageId);
    const index = pages.findIndex((page) => page.id === pageId);
    if (index === -1) return null;
    if (pages.length <= 1) return null;

    const nextIndex = direction === 'next' ? index + 1 : index - 1;
    const wrappedIndex = ((nextIndex % pages.length) + pages.length) % pages.length;
    return pages[wrappedIndex]?.id || null;
}

export function getSwipeTargetPlayerPageId(pageId, distanceX) {
    if (!distanceX) return null;
    return getAdjacentPlayerSubpageId(pageId, distanceX > 0 ? 'next' : 'previous');
}

export function shouldHandlePlayerSubpageSwipe({
    distanceX,
    distanceY,
    threshold = PLAYER_SWIPE_THRESHOLD,
    horizontalRatio = PLAYER_SWIPE_HORIZONTAL_RATIO,
}) {
    const absX = Math.abs(Number(distanceX) || 0);
    const absY = Math.abs(Number(distanceY) || 0);
    return absX >= threshold && absX > absY * horizontalRatio;
}

export function shouldCancelPlayerSubpageSwipeForVerticalScroll({
    distanceX,
    distanceY,
    verticalCancelRatio = PLAYER_SWIPE_VERTICAL_CANCEL_RATIO,
}) {
    const absX = Math.abs(Number(distanceX) || 0);
    const absY = Math.abs(Number(distanceY) || 0);
    return absY > 14 && absY > absX * verticalCancelRatio;
}

export function isPlayerSwipeExcludedTarget(target, selectors = PLAYER_SWIPE_EXCLUDE_SELECTORS) {
    if (!target?.closest) return false;
    return selectors.some((selector) => {
        try {
            return Boolean(target.closest(selector));
        } catch {
            return false;
        }
    });
}

export function hasBlockingPlayerOverlay(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc?.querySelector) return false;
    if (doc.body?.dataset?.modalLayerGesturesSuspended === 'true') return true;
    return Boolean(doc.querySelector([
        '.modal-overlay',
        '.bottom-sheet-backdrop.open',
        '.item-catalog-overlay',
        '.notification-overlay',
        '.xp-overlay',
        '[role="dialog"][aria-modal="true"]',
        '[data-player-interaction-lock="true"]',
        '[data-slot="dialog-content"]',
        '[data-slot="drawer-content"]',
    ].join(',')));
}

export function buildPlayerInteractionLockState({
    modalMode = null,
    actionModalMode = null,
    catalogMode = null,
    navDrawerOpen = false,
    dailyPrepCount = 0,
} = {}) {
    return Boolean(
        modalMode ||
        actionModalMode ||
        catalogMode ||
        navDrawerOpen ||
        dailyPrepCount > 0
    );
}
