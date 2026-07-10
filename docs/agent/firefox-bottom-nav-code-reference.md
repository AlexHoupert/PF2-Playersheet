# Firefox Bottom Navigation Code Reference

Purpose: collect the code paths that can affect the mobile player icon bar, drawer, swipe handling, safe-area spacing, and modal interaction. This is intended as a manual research aid for Firefox mobile behavior.

Current observed state:

- Chrome/mobile Chromium: swipe and bottom nav are stable.
- Other mobile browser tested by user: stable.
- Firefox mobile: bottom icon bar can visually move upward, especially when browser chrome/address bar state changes.
- The bottom nav is currently rendered in the normal player app tree, not portalled.

## Source Map

Primary bottom icon bar:

- `src/player/navigation/PlayerBottomNav.jsx`
- `src/player/navigation/playerNavigation.css`

Mounting and interaction lock:

- `src/player/PlayerAppController.jsx`
- `src/player/navigation/usePlayerPageNavigation.js`
- `src/player/navigation/playerSubpageSwipe.js`
- `src/player/navigation/usePlayerSubpageSwipe.js`

Carousel/swipe context:

- `src/player/navigation/PlayerPageCarousel.jsx`
- `src/player/navigation/PlayerSubpageCarousel.jsx`

Icon and page data:

- `src/player/navigation/playerPageRegistry.js`
- `src/player/navigation/playerNavIcons.js`

Modal hiding / scroll lock:

- `src/shared/overlays/ModalLayerProvider.jsx`
- `src/shared/overlays/modalLayer.css`

Viewport:

- `index.html`

## Viewport Meta

File: `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

No `viewport-fit=cover` is currently set.

## PlayerBottomNav Component

File: `src/player/navigation/PlayerBottomNav.jsx`

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
    getCategoryIdForPlayerPage,
    PLAYER_NAV_CATEGORIES,
} from './playerPageRegistry';
import { getPlayerNavIconSrc } from './playerNavIcons';
import './playerNavigation.css';

export default function PlayerBottomNav({
    activePageId,
    onSelectPage,
    onDrawerOpenChange,
    hasLoot = false,
}) {
    const activeCategoryId = getCategoryIdForPlayerPage(activePageId);
    const [openCategoryId, setOpenCategoryId] = useState(null);
    const [drawerCategoryId, setDrawerCategoryId] = useState(activeCategoryId);

    const drawerCategory = useMemo(() => {
        return PLAYER_NAV_CATEGORIES.find((category) => category.id === drawerCategoryId) || PLAYER_NAV_CATEGORIES[0];
    }, [drawerCategoryId]);

    useEffect(() => {
        onDrawerOpenChange?.(Boolean(openCategoryId));
    }, [onDrawerOpenChange, openCategoryId]);

    useEffect(() => {
        return () => onDrawerOpenChange?.(false);
    }, [onDrawerOpenChange]);

    const openCategory = (categoryId) => {
        if (openCategoryId === categoryId) {
            setOpenCategoryId(null);
            return;
        }
        setDrawerCategoryId(categoryId);
        setOpenCategoryId(categoryId);
    };

    const closeDrawer = () => setOpenCategoryId(null);

    const selectPage = (page) => {
        onSelectPage(page);
        closeDrawer();
    };

    return (
        <div className="player-bottom-nav-root no-swipe" data-testid="player-bottom-nav-root">
            <div
                className={`player-nav-backdrop ${openCategoryId ? 'open' : ''}`}
                onClick={closeDrawer}
                aria-hidden="true"
            />
            <section
                id="player-category-drawer"
                className={`player-category-drawer ${openCategoryId ? 'open' : ''}`}
                aria-hidden={!openCategoryId}
                aria-label={drawerCategory ? `${drawerCategory.label} pages` : 'Player pages'}
            >
                <div className="player-category-drawer__handle" />
                <div className="player-category-drawer__header">
                    <span className="player-category-drawer__eyebrow">Player</span>
                    <h2>{drawerCategory.label}</h2>
                </div>
                <div className="player-category-drawer__pages">
                    {drawerCategory.pages.map((page) => {
                        const active = page.id === activePageId;
                        const hasPageLoot = page.alertKey === 'loot' && hasLoot;
                        const iconSrc = getPlayerNavIconSrc(page.icon);
                        return (
                            <button
                                key={page.id}
                                type="button"
                                className={`player-category-drawer__page ${active ? 'active' : ''}`}
                                onClick={() => selectPage(page)}
                                data-testid={`player-nav-page-${page.id}`}
                            >
                                <span className="player-category-drawer__page-icon-wrap">
                                    <img src={iconSrc} alt="" className="player-category-drawer__page-icon" />
                                </span>
                                <span className="player-category-drawer__page-main">
                                    <span>{page.label}</span>
                                    {hasPageLoot && <span className="player-nav-alert-dot" aria-label="New loot" />}
                                </span>
                                {page.future && <span className="player-category-drawer__page-note">Soon</span>}
                            </button>
                        );
                    })}
                </div>
            </section>
            <nav className="player-bottom-nav" aria-label="Player navigation">
                {PLAYER_NAV_CATEGORIES.map((category) => {
                    const active = category.id === activeCategoryId;
                    const open = category.id === openCategoryId;
                    const iconSrc = getPlayerNavIconSrc(category.icon);
                    const categoryHasLoot = category.id === 'items' && hasLoot;
                    return (
                        <button
                            key={category.id}
                            type="button"
                            className={`player-bottom-nav__item ${active ? 'active' : ''} ${open ? 'open' : ''}`}
                            onClick={() => openCategory(category.id)}
                            aria-expanded={open}
                            aria-controls="player-category-drawer"
                            data-testid={`player-nav-category-${category.id}`}
                        >
                            <span className="player-bottom-nav__icon-wrap">
                                <img src={iconSrc} alt="" className="player-bottom-nav__icon" />
                                {categoryHasLoot && <span className="player-bottom-nav__badge" aria-label="New loot" />}
                            </span>
                            <span className="player-bottom-nav__label">{category.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
```

## Bottom Nav CSS

File: `src/player/navigation/playerNavigation.css`

Relevant variables and default state:

```css
:root {
    --player-bottom-nav-height: 72px;
    --player-bottom-nav-bg: rgba(18, 18, 20, 0.96);
    --player-bottom-nav-border: rgba(197, 160, 89, 0.38);
}

.player-bottom-nav-root {
    display: none;
}
```

Mobile spacing and old tab hiding:

```css
@media (max-width: 768px) {
    body {
        padding-bottom: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 10px);
    }

    .app-container.player-nav-v2-active {
        padding-bottom: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
    }

    .app-container.player-nav-v2-active .tabs {
        display: none;
    }
}
```

Fixed root container:

```css
@media (max-width: 768px) {
    .player-bottom-nav-root {
        display: block;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
        pointer-events: none;
        z-index: 1600;
    }
}
```

Backdrop and drawer:

```css
@media (max-width: 768px) {
    .player-nav-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
        background: rgba(0, 0, 0, 0);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease, background 180ms ease;
        z-index: 1601;
    }

    .player-nav-backdrop.open {
        background: rgba(0, 0, 0, 0.42);
        opacity: 1;
        pointer-events: auto;
    }

    .player-category-drawer {
        position: fixed;
        left: 10px;
        right: 10px;
        bottom: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 8px);
        max-height: min(58vh, 440px);
        display: flex;
        flex-direction: column;
        background: rgba(31, 31, 34, 0.98);
        border: 1px solid rgba(197, 160, 89, 0.36);
        border-bottom-color: rgba(197, 160, 89, 0.62);
        border-radius: 14px 14px 10px 10px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
        overflow: hidden;
        opacity: 0;
        transform: translateY(22px) scale(0.96, 0.9);
        transform-origin: bottom center;
        transition: transform 230ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 165ms ease;
        pointer-events: none;
        z-index: 1602;
    }

    .player-category-drawer.open {
        opacity: 1;
        transform: translateY(0) scaleY(1);
        pointer-events: auto;
    }
}
```

Bottom icon bar:

```css
@media (max-width: 768px) {
    .player-bottom-nav {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        align-items: stretch;
        padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
        background: var(--player-bottom-nav-bg);
        border-top: 1px solid var(--player-bottom-nav-border);
        box-shadow: 0 -14px 32px rgba(0, 0, 0, 0.45);
        pointer-events: auto;
        z-index: 1603;
    }

    .player-bottom-nav__item {
        position: relative;
        min-width: 0;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #a7a7a7;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 4px 2px;
        cursor: pointer;
        font: inherit;
    }

    .player-bottom-nav__item.active,
    .player-bottom-nav__item.open {
        color: var(--text-gold);
        background: rgba(197, 160, 89, 0.1);
    }

    .player-bottom-nav__item.open::before {
        content: '';
        position: absolute;
        top: -7px;
        left: 22%;
        right: 22%;
        height: 2px;
        border-radius: 999px;
        background: var(--text-gold);
    }

    .player-bottom-nav__icon-wrap {
        position: relative;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        overflow: hidden;
        background: #050505;
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .player-bottom-nav__icon {
        width: 100%;
        height: 100%;
        display: block;
        opacity: 0.9;
    }

    .player-bottom-nav__item.active .player-bottom-nav__icon-wrap,
    .player-bottom-nav__item.open .player-bottom-nav__icon-wrap {
        border-color: rgba(197, 160, 89, 0.85);
        box-shadow: 0 0 14px rgba(197, 160, 89, 0.18);
    }

    .player-bottom-nav__label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.64rem;
        line-height: 1.05;
        font-weight: 700;
    }
}
```

Modal-layer hiding:

```css
@media (max-width: 768px) {
    body[data-modal-layer-active="true"] .player-bottom-nav,
    body[data-modal-layer-active="true"] .player-category-drawer,
    body[data-modal-layer-active="true"] .player-nav-backdrop {
        pointer-events: none;
    }

    body[data-modal-layer-active="true"] .player-bottom-nav-root {
        opacity: 0;
        visibility: hidden;
    }
}
```

Subpage carousel touch CSS, relevant because the page swipe area and bottom nav coexist:

```css
.player-subpage-carousel__content {
    align-items: center;
    gap: 4px;
    margin-left: 0;
    touch-action: pan-y;
}

.player-page-carousel__content {
    margin-left: 0;
    touch-action: pan-y;
}
```

## Mount Point in PlayerAppController

File: `src/player/PlayerAppController.jsx`

State and interaction lock:

```jsx
const [playerNavDrawerOpen, setPlayerNavDrawerOpen] = useState(false);

const isPlayerInteractionLocked = buildPlayerInteractionLockState({
    modalMode,
    actionModalMode: actionModal.mode,
    catalogMode,
    navDrawerOpen: playerNavDrawerOpen,
    dailyPrepCount: dailyPrepQueue.length,
});
```

Navigation hook:

```jsx
const {
    activeCharIndex,
    activePageId,
    character,
    characters,
    selectPage,
    selectPageId,
    setActiveCharIndex,
    swipeHandlers,
    swipeRef,
} = usePlayerPageNavigation({
    activeCampaign,
    isInteractionLocked: isPlayerInteractionLocked,
    myCharacter,
});
```

App shell receives swipe handlers:

```jsx
return (
    <div
        className="app-container player-nav-v2-active"
        ref={swipeRef}
        {...swipeHandlers}
        onClick={handleContentLinkClick}
    >
        ...
    </div>
);
```

Bottom nav mount:

```jsx
<PlayerBottomNav
    activePageId={activePageId}
    onSelectPage={selectPage}
    onDrawerOpenChange={setPlayerNavDrawerOpen}
    hasLoot={hasPlayerLoot}
/>
```

## Player Page Navigation Hook

File: `src/player/navigation/usePlayerPageNavigation.js`

```js
export function usePlayerPageNavigation({
    activeCampaign,
    isInteractionLocked = false,
    myCharacter,
}) {
    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const [activePageId, setActivePageId] = useState(readInitialPageId);
    const characters = useMemo(() => selectActiveCharacters(activeCampaign), [activeCampaign]);
    const character = characters[activeCharIndex];
    const swipeRef = useRef(null);

    const selectPageId = (pageId) => {
        const page = getPlayerPage(pageId);
        if (!page) return;
        setActivePageId(page.id);
    };

    const selectPage = (page) => {
        if (!page?.id) return;
        selectPageId(page.id);
    };

    const swipeHandlers = usePlayerSubpageSwipe({
        activePageId,
        disabled: isInteractionLocked,
        onSelectPageId: selectPageId,
    });

    return {
        activeCharIndex,
        activePageId,
        character,
        characters,
        selectPage,
        selectPageId,
        setActiveCharIndex,
        swipeHandlers,
        swipeRef,
    };
}
```

## Swipe Rules and Exclusions

File: `src/player/navigation/playerSubpageSwipe.js`

```js
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
```

File: `src/player/navigation/usePlayerSubpageSwipe.js`

```js
export function usePlayerSubpageSwipe({
    activePageId,
    disabled = false,
    onSelectPageId,
    threshold = PLAYER_SWIPE_THRESHOLD,
}) {
    const startRef = useRef(null);
    const activePointerIdRef = useRef(null);
    const pointerStartedAtRef = useRef(0);
    const disabledRef = useRef(Boolean(disabled));
    const activePageIdRef = useRef(activePageId);
    const onSelectPageIdRef = useRef(onSelectPageId);

    disabledRef.current = Boolean(disabled);
    activePageIdRef.current = activePageId;
    onSelectPageIdRef.current = onSelectPageId;

    const isLocked = useCallback(() => {
        return disabledRef.current || hasBlockingPlayerOverlay();
    }, []);

    const startGesture = useCallback((eventTarget, x, y) => {
        if (isLocked()) return;
        if (isPlayerSwipeExcludedTarget(eventTarget)) return;
        startRef.current = {
            x,
            y,
            cancelled: false,
        };
    }, [isLocked]);

    const moveGesture = useCallback((x, y) => {
        const start = startRef.current;
        if (!start || start.cancelled) return;
        if (isLocked()) {
            reset();
            return;
        }

        const distanceX = start.x - x;
        const distanceY = start.y - y;
        if (shouldCancelPlayerSubpageSwipeForVerticalScroll({ distanceX, distanceY })) {
            start.cancelled = true;
        }
    }, [isLocked, reset]);

    const endGesture = useCallback((x, y) => {
        const start = startRef.current;
        reset();
        if (!start || start.cancelled || isLocked()) return;

        const distanceX = start.x - x;
        const distanceY = start.y - y;
        if (!shouldHandlePlayerSubpageSwipe({ distanceX, distanceY, threshold })) return;

        const targetPageId = getSwipeTargetPlayerPageId(activePageIdRef.current, distanceX);
        if (targetPageId) {
            onSelectPageIdRef.current?.(targetPageId);
        }
    }, [isLocked, reset, threshold]);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel: reset,
    };
}
```

## Carousel Components

File: `src/player/navigation/PlayerPageCarousel.jsx`

```jsx
<Carousel
    key={categoryId}
    className="player-page-carousel"
    opts={{
        align: 'start',
        containScroll: false,
        dragFree: false,
        loop: pages.length > 1,
        skipSnaps: false,
        watchDrag: false,
    }}
    setApi={setApi}
>
    <CarouselContent className="player-page-carousel__content">
        {pages.map((page, index) => (
            <CarouselItem key={page.id} className="player-page-carousel__item">
                ...
            </CarouselItem>
        ))}
    </CarouselContent>
</Carousel>
```

Important note: `watchDrag: false` disables Embla drag for the page carousel. Page swipe is currently handled by `usePlayerSubpageSwipe` on the app container instead.

File: `src/player/navigation/PlayerSubpageCarousel.jsx`

```jsx
<Carousel
    className="player-subpage-carousel"
    opts={{
        align: 'center',
        containScroll: false,
        dragFree: false,
        loop: pages.length > 1,
        skipSnaps: false,
    }}
    setApi={setApi}
    aria-label="Current section pages"
>
    <CarouselContent className="player-subpage-carousel__content">
        ...
    </CarouselContent>
</Carousel>
```

## Page and Icon Registry

File: `src/player/navigation/playerPageRegistry.js`

```js
export const PLAYER_NAV_CATEGORIES = [
    {
        id: 'character',
        label: 'Character',
        icon: 'skills',
        pages: [
            { id: 'character.status', label: 'Status', icon: 'heart-beats' },
            { id: 'character.feats', label: 'Feats', icon: 'laurels-trophy' },
            { id: 'character.magic', label: 'Magic', icon: 'magic-swirl' },
            { id: 'character.impulses', label: 'Impulses', icon: 'lightning-arc' },
            { id: 'character.pact', label: 'Pact', icon: 'shaking-hands' },
            { id: 'character.owned-actor', label: 'Companion', icon: 'wolf-head' },
            { id: 'character.proficiencies', label: 'Proficiencies', future: true, icon: 'crossed-swords' },
        ],
    },
    {
        id: 'skills',
        label: 'Skills',
        icon: 'dice-twenty-faces-twenty',
        pages: [
            { id: 'skills.combat', label: 'Combat', icon: 'crossed-swords' },
            { id: 'skills.movement', label: 'Movement', icon: 'running-shoe' },
            { id: 'skills.general', label: 'General', icon: 'skills' },
            { id: 'skills.downtime', label: 'Downtime', icon: 'hourglass' },
            { id: 'skills.exploration', label: 'Exploration', future: true, icon: 'compass' },
            { id: 'skills.camping', label: 'Camping', icon: 'campfire' },
        ],
    },
    {
        id: 'items',
        label: 'Items',
        icon: 'drink-me',
        pages: [
            { id: 'items.equipment', label: 'Equipment', icon: 'backpack' },
            { id: 'items.consumables', label: 'Consumables', icon: 'potion-ball' },
            { id: 'items.misc', label: 'Misc.', icon: 'swap-bag' },
            { id: 'items.shop', label: 'Shop', icon: 'cash' },
            { id: 'items.crafting', label: 'Crafting', future: true, icon: 'hammer-nails' },
            { id: 'items.loot', label: 'Loot', alertKey: 'loot', icon: 'locked-chest' },
        ],
    },
    {
        id: 'knowledge',
        label: 'Knowledge',
        icon: 'bookmarklet',
        pages: [
            { id: 'knowledge.history', label: 'History', icon: 'scroll-quill' },
            { id: 'knowledge.locations', label: 'Locations', icon: 'world' },
            { id: 'knowledge.npcs', label: 'NPCs', icon: 'cloak-dagger' },
            { id: 'knowledge.bestiary', label: 'Bestiary', icon: 'monster-grasp' },
            { id: 'knowledge.other', label: 'Other', icon: 'bookshelf' },
        ],
    },
    {
        id: 'campaign',
        label: 'Campaign',
        icon: 'treasure-map',
        pages: [
            { id: 'campaign.quests', label: 'Quests', icon: 'rolled-cloth' },
            { id: 'campaign.progress', label: 'Progress', icon: 'progression' },
            { id: 'campaign.maps', label: 'Maps', icon: 'treasure-map' },
            { id: 'campaign.camp', label: 'Camp', icon: 'campfire' },
        ],
    },
];
```

File: `src/player/navigation/playerNavIcons.js`

```js
export const PLAYER_NAV_ICON_SRC = {
    backpack: backpackIcon,
    bookmarklet: bookmarkletIcon,
    bookshelf: bookshelfIcon,
    campfire: campfireIcon,
    cash: cashIcon,
    'cloak-dagger': cloakDaggerIcon,
    compass: compassIcon,
    'crossed-swords': crossedSwordsIcon,
    'dice-twenty-faces-twenty': diceIcon,
    'drink-me': drinkIcon,
    'hammer-nails': hammerNailsIcon,
    'heart-beats': heartBeatsIcon,
    hourglass: hourglassIcon,
    'laurels-trophy': laurelsTrophyIcon,
    'lightning-arc': lightningArcIcon,
    'locked-chest': lockedChestIcon,
    'magic-swirl': magicSwirlIcon,
    'monster-grasp': monsterGraspIcon,
    'potion-ball': potionBallIcon,
    progression: progressionIcon,
    'rolled-cloth': rolledClothIcon,
    'running-shoe': runningShoeIcon,
    'scroll-quill': scrollQuillIcon,
    'shaking-hands': shakingHandsIcon,
    skills: skillsIcon,
    'swap-bag': swapBagIcon,
    'treasure-map': treasureMapIcon,
    'wolf-head': wolfHeadIcon,
    world: worldIcon,
};

export function getPlayerNavIconSrc(iconKey) {
    return PLAYER_NAV_ICON_SRC[iconKey] || skillsIcon;
}
```

## Modal Layer Interaction

File: `src/shared/overlays/ModalLayerProvider.jsx`

Relevant body/html mutations while blocking modal is open:

```jsx
useEffect(() => {
    if (!lockPageScroll) return undefined;

    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyTouchAction = body.style.touchAction;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.classList.add('modal-layer-scroll-locked');
    html.classList.add('modal-layer-scroll-locked');

    return () => {
        body.style.overflow = previousBodyOverflow;
        body.style.touchAction = previousBodyTouchAction;
        html.style.overflow = previousHtmlOverflow;
        html.style.overscrollBehavior = previousHtmlOverscroll;
        body.classList.remove('modal-layer-scroll-locked');
        html.classList.remove('modal-layer-scroll-locked');
    };
}, [lockPageScroll]);

useEffect(() => {
    document.body.dataset.modalLayerActive = hasActiveModal ? 'true' : 'false';
    document.body.dataset.modalLayerGesturesSuspended = suspendPageGestures ? 'true' : 'false';
    return () => {
        delete document.body.dataset.modalLayerActive;
        delete document.body.dataset.modalLayerGesturesSuspended;
    };
}, [hasActiveModal, suspendPageGestures]);
```

File: `src/shared/overlays/modalLayer.css`

```css
.modal-layer-scroll-locked {
    overscroll-behavior: none;
}

.modal-layer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 11000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.72);
    overscroll-behavior: contain;
    touch-action: none;
}

.modal-layer-surface {
    width: min(560px, 100%);
    max-height: calc(100dvh - 32px);
    min-height: 0;
    overflow: hidden;
    outline: none;
    border: 1px solid #c5a059;
    border-radius: 8px;
    background: #202020;
    color: #eee;
    box-shadow: 0 20px 54px rgba(0, 0, 0, 0.6);
    touch-action: pan-y;
}
```

## CSS Properties Most Likely Relevant To Firefox

These are the areas most likely worth researching for Firefox mobile:

- `position: fixed` on `.player-bottom-nav-root`.
- Nested `position: absolute` on `.player-bottom-nav` inside a fixed root.
- `bottom: 0` plus `env(safe-area-inset-bottom, 0px)`.
- Browser chrome / address bar changing visual viewport height.
- The missing `viewport-fit=cover` viewport option.
- Modal code mutating `body.style.overflow`, `body.style.touchAction`, `html.style.overflow`, and `html.style.overscrollBehavior`.
- `body` and `.app-container` bottom padding tied to `--player-bottom-nav-height`.
- Touch handlers on `.app-container` and excluded `.player-bottom-nav-root`.
- Avoiding transforms on fixed ancestors; current bottom nav root does not use transform.

## Previous Fixes Already Applied

These are useful when researching regressions:

- `PlayerPageCarousel` uses `watchDrag: false`, so Embla does not also process drag gestures for page changes.
- `PLAYER_SWIPE_THRESHOLD` is `108`, reducing accidental double-page jumps.
- `PlayerBottomNav` is not portalled; it is rendered inside `PlayerAppController`.
- `.player-bottom-nav-root` is `position: fixed` and no longer uses transform-based jitter fixes.

