import { useEffect, useMemo, useRef, useState } from 'react';
import { selectActiveCharacters } from '../../shared/db/selectors/characterSelectors';
import {
    getPlayerPage,
    getPlayerPageForLegacyNavigation,
    PLAYER_PAGE_IDS,
} from './playerPageRegistry';

const PLAYER_PAGE_STORAGE_KEY = 'pf2.player.activePageId';

export function usePlayerPageNavigation({
    activeCampaign,
    myCharacter,
}) {
    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const [activePageId, setActivePageId] = useState(readInitialPageId);
    const characters = useMemo(() => selectActiveCharacters(activeCampaign), [activeCampaign]);
    const character = characters[activeCharIndex];
    const swipeRef = useRef(null);

    useEffect(() => {
        if (myCharacter && characters.length) {
            const idx = characters.findIndex(c => c.id === myCharacter.id);
            if (idx !== -1) setActiveCharIndex(idx);
        }
    }, [myCharacter, characters]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(PLAYER_PAGE_STORAGE_KEY, activePageId);
        } catch {
            // Local storage can be unavailable in private contexts; navigation still works in memory.
        }
    }, [activePageId]);

    const selectPageId = (pageId) => {
        const page = getPlayerPage(pageId);
        if (!page) return;
        setActivePageId(page.id);
    };

    const selectPage = (page) => {
        if (!page?.id) return;
        selectPageId(page.id);
    };

    const goToLegacyTab = (activeTab, appMode) => {
        selectPageId(getPlayerPageForLegacyNavigation(activeTab, appMode));
    };

    return {
        activeCharIndex,
        activePageId,
        character,
        characters,
        goToLegacyTab,
        selectPage,
        selectPageId,
        setActiveCharIndex,
        swipeHandlers: {},
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
