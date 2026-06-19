import { useEffect, useMemo, useState } from 'react';
import { useSwipe } from '../../shared/hooks/useSwipe';
import { selectPact } from '../../shared/db/selectors/pactSelectors';

export function usePlayerNavigation({
    activeCampaign,
    db,
    modalMode,
    myCharacter,
}) {
    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const [activeTab, setActiveTab] = useState('stats');
    const [appMode, setAppMode] = useState('character');
    const characters = activeCampaign?.characters || [];
    const character = characters[activeCharIndex];

    useEffect(() => {
        if (myCharacter && activeCampaign?.characters) {
            const idx = activeCampaign.characters.findIndex(c => c.id === myCharacter.id);
            if (idx !== -1) setActiveCharIndex(idx);
        }
    }, [myCharacter, activeCampaign]);

    useEffect(() => {
        if (appMode === 'story' && !['quests', 'lore', 'maps', 'progress', 'camp'].includes(activeTab)) {
            setActiveTab('quests');
        }
        const validCharacterTabs = [...mainCharacterTabs(character, db), 'shop'];
        if (appMode === 'character' && !validCharacterTabs.includes(activeTab)) {
            setActiveTab('stats');
        }
    }, [activeTab, appMode, character, db]);

    const mainTabs = useMemo(() => {
        if (appMode === 'story') {
            return ['quests', 'lore', 'maps', 'progress', 'camp'];
        }
        return mainCharacterTabs(character, db);
    }, [appMode, character, db]);

    const { handlers: swipeHandlers, ref: swipeRef } = useSwipe({
        onSwipeLeft: () => {
            if (modalMode) return;
            const idx = mainTabs.indexOf(activeTab);
            if (idx > -1 && idx < mainTabs.length - 1) {
                setActiveTab(mainTabs[idx + 1]);
            }
        },
        onSwipeRight: () => {
            if (modalMode) return;
            const idx = mainTabs.indexOf(activeTab);
            if (idx > 0) {
                setActiveTab(mainTabs[idx - 1]);
            }
        },
        threshold: 60,
        disabled: Boolean(modalMode),
        excludeSelectors: ['.tabs', '.modal-tabs', '.scroll-x', '.no-swipe']
    });

    return {
        activeCharIndex,
        activeTab,
        appMode,
        character,
        characters,
        mainTabs,
        setActiveCharIndex,
        setActiveTab,
        setAppMode,
        swipeHandlers,
        swipeRef,
    };
}

function mainCharacterTabs(character, db) {
    if (!character) return ['stats', 'actions', 'feats', 'items'];
    const tabs = ['stats', 'actions', 'feats'];
    if (character.isCaster || character.magic?.list?.length > 0) tabs.push('magic');
    if (character.isKineticist) tabs.push('impulses');
    tabs.push('items');
    if (character.has_companion) tabs.push('companion');
    if (character.pact?.pactId && selectPact(db, character.pact.pactId)) tabs.push('pact');
    return tabs;
}
