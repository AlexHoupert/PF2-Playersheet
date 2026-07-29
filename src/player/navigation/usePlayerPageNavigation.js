import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { selectActiveCharacters } from '../../shared/db/selectors/characterSelectors';
import {
    buildPlayerNavigationContext,
    getPlayerPage,
    getPlayerPageForLegacyNavigation,
    getVisiblePlayerPage,
    getVisiblePlayerPageId,
    PLAYER_PAGE_IDS,
} from './playerPageRegistry';
import { usePlayerSubpageSwipe } from './usePlayerSubpageSwipe';

const PLAYER_PAGE_STORAGE_KEY = 'pf2.player.activePageId';

export function usePlayerPageNavigation({
    activeCampaign,
    isInteractionLocked = false,
    myCharacter,
    ownedCompanionActors = [],
    loopPages = true,
    pageOrderByCategory,
}) {
    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const [activePageId, setActivePageId] = useState(readInitialPageId);
    const characters = useMemo(() => selectActiveCharacters(activeCampaign), [activeCampaign]);
    const character = characters[activeCharIndex];
    const swipeRef = useRef(null);
    const initializedActorRef = useRef(false);
    const navigationContext = useMemo(
        () => buildPlayerNavigationContext({ character, ownedCompanionActors, pageOrderByCategory }),
        [character, ownedCompanionActors, pageOrderByCategory]
    );

    useEffect(() => {
        if (!initializedActorRef.current && myCharacter && characters.length) {
            const idx = characters.findIndex(c => c.id === myCharacter.id);
            if (idx !== -1) {
                setActiveCharIndex(idx);
                initializedActorRef.current = true;
            }
        }
    }, [myCharacter, characters]);

    useEffect(() => {
        if (characters.length > 0 && activeCharIndex >= characters.length) setActiveCharIndex(0);
    }, [activeCharIndex, characters.length]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(PLAYER_PAGE_STORAGE_KEY, activePageId);
        } catch {
            // Local storage can be unavailable in private contexts; navigation still works in memory.
        }
    }, [activePageId]);

    useEffect(() => {
        const visiblePageId = getVisiblePlayerPageId(activePageId, navigationContext);
        if (visiblePageId !== activePageId) {
            setActivePageId(visiblePageId);
        }
    }, [activePageId, navigationContext]);

    const selectPageId = useCallback((pageId) => {
        const page = getVisiblePlayerPage(pageId, navigationContext);
        if (!page) return;
        setActivePageId(page.id);
    }, [navigationContext]);

    const selectPage = useCallback((page) => {
        if (!page?.id) return;
        selectPageId(page.id);
    }, [selectPageId]);

    const goToLegacyTab = (activeTab, appMode) => {
        selectPageId(getPlayerPageForLegacyNavigation(activeTab, appMode));
    };

    const swipeHandlers = usePlayerSubpageSwipe({
        activePageId,
        disabled: isInteractionLocked,
        navigationContext,
        loopPages,
        onSelectPageId: selectPageId,
    });

    return {
        activeCharIndex,
        activePageId,
        character,
        characters,
        goToLegacyTab,
        navigationContext,
        selectPage,
        selectPageId,
        setActiveCharIndex,
        swipeHandlers,
        swipeRef,
    };
}

function readInitialPageId() {
    if (typeof window === 'undefined') return PLAYER_PAGE_IDS.STATUS;
    const params = new URLSearchParams(window.location.search);
    const directPage = normalizePageId(params.get('playerPage'));
    if (directPage) return directPage;

    const legacyPage = getPlayerPageForLegacyNavigation(
        params.get('playerTab') || undefined,
        params.get('playerMode') || undefined
    );
    if (legacyPage) return legacyPage;

    try {
        const storedPage = normalizePageId(window.localStorage.getItem(PLAYER_PAGE_STORAGE_KEY));
        if (storedPage) return storedPage;
    } catch {
        // Ignore storage failures and use the default status page.
    }

    return PLAYER_PAGE_IDS.STATUS;
}

function normalizePageId(pageId) {
    if (!pageId) return null;
    return getPlayerPage(pageId)?.id || null;
}
