import React, { useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';

import SpellScrollSelectorModal from './modals/SpellScrollSelectorModal';
import { deepClone } from '../shared/utils/deepClone';
import ItemActionsModal from './ItemActionsModal';
import { ModalManager } from './ModalManager';
import { usePlayerCatalogInspection } from './hooks/usePlayerCatalogInspection';
import { usePlayerCharacterActions } from './hooks/usePlayerCharacterActions';
import { usePlayerInventoryActions } from './hooks/usePlayerInventoryActions';
import { usePlayerModalState } from './hooks/usePlayerModalState';
import { selectActorRulesViewModel } from '../shared/rules/actorRulesViewModel';
import LazyCatalogOverlay from './components/LazyCatalogOverlay';
import PlayerBottomNav from './navigation/PlayerBottomNav';
import PlayerDesktopNav from './navigation/PlayerDesktopNav';
import PlayerPageCarousel from './navigation/PlayerPageCarousel';
import { buildPlayerInteractionLockState } from './navigation/playerSubpageSwipe';
import { usePlayerPageNavigation } from './navigation/usePlayerPageNavigation';
import PlayerPopupHost from './popups/PlayerPopupHost';
export default function PlayerAppController() {
    const {
        activeCampaign,
        myActor,
        myCharacter,
        isGM,
        dataActions,
        db,
        quests: playerQuests,
        lootBags: playerLootBags,
        ownedActors,
    } = useCampaign();

    const {
        actionModal,
        catalogMode,
        condTab,
        handleBack,
        modalData,
        modalHistory,
        modalMode,
        setActionModal,
        setCatalogMode,
        setCondTab,
        setModalData,
        setModalHistory,
        setModalMode,
    } = usePlayerModalState();

    const [dailyPrepQueue, setDailyPrepQueue] = useState([]);
    const [playerNavDrawerOpen, setPlayerNavDrawerOpen] = useState(false);
    const ownedCompanionActors = (ownedActors || [])
        .filter(actor => ['animal_companion', 'familiar', 'pet'].includes(actor.kind));
    const playerNotificationQueue = [
        ...(activeCampaign?.notificationQueue || []),
        ...(db?.notificationQueue || []),
    ];
    const isPlayerInteractionLocked = buildPlayerInteractionLockState({
        modalMode,
        actionModalMode: actionModal.mode,
        catalogMode,
        navDrawerOpen: playerNavDrawerOpen,
        dailyPrepCount: dailyPrepQueue.length,
    });

    const {
        activeCharIndex,
        activePageId,
        character,
        characters,
        navigationContext,
        selectPage,
        selectPageId,
        setActiveCharIndex,
        swipeHandlers,
        swipeRef,
    } = usePlayerPageNavigation({
        activeCampaign,
        isInteractionLocked: isPlayerInteractionLocked,
        myCharacter,
        ownedCompanionActors,
    });

    const actorRules = selectActorRulesViewModel(activeCampaign, myActor?.id || character?.id);
    const rulesCharacter = actorRules.character || character;
    const characterConditions = actorRules.conditions || [];

    const {
        characterActions,
        handleClearNotification,
        runDataAction,
        saveNewAction,
        updateCharacter,
    } = usePlayerCharacterActions({
        activeCampaign,
        activeCharIndex,
        character,
        dataActions,
        setModalMode,
    });

    const {
        handleContentLinkClick,
        shopItemDetailError,
        shopItemDetailLoading,
    } = usePlayerCatalogInspection({
        db,
        modalData,
        modalMode,
        setModalData,
        setModalHistory,
        setModalMode,
    });

    const {
        addToCharacter,
        executeBuy,
        executeQty,
        executeTransfer,
        executeUnstack,
        fireWeapon,
        handleBuyFormula,
        handleConsumeItem,
        handleLoadSpecial,
        handleLongPress,
        handleUnloadAll,
        inspectInventoryItem,
        loadWeapon,
        performDailyPrep,
        pressEvents,
        removeFromCharacter,
        toggleBloodmagic,
        toggleInventoryEquipped,
    } = usePlayerInventoryActions({
        activeCampaign,
        activeCharIndex,
        character,
        characters,
        dataActions,
        runDataAction,
        setActionModal,
        setCatalogMode,
        setDailyPrepQueue,
        setModalData,
        setModalMode,
        updateCharacter,
    });

    const hasPlayerLoot = (
        character?.inventory?.some(i => i.isLoot) ||
        playerLootBags.some(b => !b.isLocked && (b.items || []).some(i => !i.claimedBy))
    );

    // If no character found (e.g. empty campaign), guard against crash
    if (!character) {
        return (
            <div style={{ padding: 20, color: '#e0e0e0', textAlign: 'center', marginTop: '20vh' }}>
                <h1 style={{ fontFamily: 'Cinzel, serif', color: '#c5a059' }}>PF2e Companion</h1>
                {activeCampaign ? (
                    <div>
                        <h3>Connected to: {activeCampaign.name}</h3>
                        <p>No character assigned to you.</p>
                        <p style={{ opacity: 0.7 }}>Ask your GM to assign a character to your email.</p>
                    </div>
                ) : (
                    <div>
                        <h3>No Active Campaign</h3>
                        <p>Waiting for connection...</p>
                    </div>
                )}

                <div style={{ marginTop: 40 }}>
                    <button
                        onClick={() => window.location.search = '?admin=true'}
                        style={{ padding: '10px 20px', background: '#333', border: '1px solid #555', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                    >
                        Login as GM
                    </button>
                </div>
            </div>
        );
    }


    // --- MAIN RENDER ---

    return (
        <div className="app-container player-nav-v2-active" ref={swipeRef} {...swipeHandlers} onClick={handleContentLinkClick}>
            {/* HEADER */}
            <style>{`
                /* MAGIC TAB CSS */
                .magic-split { display: grid; grid-template-columns: 80px 1fr; gap: 15px; align-items: start; }
                .magic-stat-block { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 15px; }
                .hex-box {
                    width: 70px; height: 75px; background: #222;
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    box-shadow: 0 0 10px var(--text-gold); position: relative;
                }
                .hex-content { text-align: center; z-index: 2; margin-top: -2px; }
                .spell-attack-box {
                    background: #2b2b2e; border: 2px solid #5c4033;
                    padding: 5px 0; border-radius: 4px; text-align: center; width: 70px;
                }
                .slot-box {
                    background: #2b2b2e; border: 1px solid #5c4033; border-radius: 4px; padding: 1px;
                    margin-bottom: 4px; text-align: center; width: 100%;
                }
                .slot-title { font-size: 0.6em; text-transform: uppercase; color: #888; margin-bottom: 2px; }
                .slot-checks { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; width: 52px; margin: 0 auto; padding: 2px 0; }
                .slot-check {
                    width: 14px; height: 14px; background: #111; border: 1px solid var(--text-gold);
                    transform: rotate(45deg); cursor: pointer; margin: 4px;
                }
                .slot-check.active { background: var(--text-gold); box-shadow: 0 0 5px var(--text-gold); }
                .spell-list-header {
                    background: transparent; padding: 5px 0; font-family: 'Cinzel', serif; font-size: 1.1em;
                    color: var(--text-gold); margin-top: 15px; border-bottom: 2px solid #5c4033; font-weight: bold;
                }
                .spell-row {
                    display: flex; justify-content: space-between; align-items: center; padding: 8px 10px;
                    border-bottom: 1px solid #333; cursor: pointer;
                }
                .spell-row:hover { background: rgba(255,255,255,0.03); }
                .spell-meta { display: flex; align-items: center; gap: 8px; font-size: 0.8em; color: #888; }
                .bloodline-drop { color: #d32f2f; margin-left: 5px; font-size: 0.9em; }

                /* MOBILE TABS POLISH */
                .tabs { 
                    display: flex; 
                    flex-wrap: nowrap; 
                    gap: 5px; 
                    overflow-x: auto; 
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none; /* Firefox */
                }
                .tabs::-webkit-scrollbar { display: none; } /* Chrome/Safari */
                .tab-btn { 
                    flex: 1; 
                    white-space: nowrap; 
                    min-width: fit-content; 
                    padding: 8px 12px;
                }
                
                /* MODAL TABS POLISH */
                .modal-tabs {
                    display: flex;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                    gap: 5px;
                    margin-bottom: 15px;
                    padding-bottom: 5px;
                    -webkit-overflow-scrolling: touch;
                }
                .modal-tabs .tab-btn {
                    flex: 1; /* Match main tabs behavior (squeeze) */
                    min-width: 0; /* Allow shrinking below content size if needed, or stick to fit-content */
                    padding: 8px 4px; /* Reduced padding */
                    font-size: 0.9em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .header-title { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; }
                .header-title h1 { overflow: hidden; text-overflow: ellipsis; }

            `}</style>
            <div className="header-bar">
                <div className="header-title">
                    <h1 {...pressEvents(null, 'level')}>{character.name}</h1>
                    <small>Level {character.level} | XP: {character.xp.current}</small>
                </div>
                <div className="header-controls" style={{ flexShrink: 0, gap: 5, marginRight: -5 }}>
                    {isGM && <button className="btn-char-switch" onClick={() => {
                        setActiveCharIndex((prev) => (prev + 1) % characters.length);
                    }}>👥</button>}
                    <div className="gold-display" data-testid="player-gold-display" onClick={() => setModalMode('gold')}>
                        <span>💰</span> {parseFloat(character.gold).toFixed(2)} <span className="gold-unit">gp</span>
                    </div>
                    {isGM && <button className="btn-char-switch" onClick={() => window.location.search = '?admin=true'} title="GM Screen">GM</button>}
                </div>
            </div>


            <PlayerDesktopNav
                activePageId={activePageId}
                navigationContext={navigationContext}
                onSelectPage={selectPage}
                hasLoot={hasPlayerLoot}
            />

            {/* VIEW CONTENT */}
            <div className="view-section">
                <PlayerPageCarousel
                    activePageId={activePageId}
                    navigationContext={navigationContext}
                    onSelectPageId={selectPageId}
                    rendererProps={{
                        activeCampaign,
                        actorRules,
                        character,
                        characterActions,
                        characterConditions,
                        dataActions,
                        db,
                        fireWeapon,
                        handleBuyFormula,
                        handleConsumeItem,
                        handleLongPress,
                        inspectInventoryItem,
                        loadWeapon,
                        myActor,
                        onGoToPage: selectPageId,
                        ownedCompanionActors,
                        playerQuests,
                        rulesCharacter,
                        runDataAction,
                        setActionModal,
                        setCatalogMode,
                        setModalData,
                        setModalMode,
                        toggleInventoryEquipped,
                        updateCharacter,
                    }}
                />
            </div>

            {/* MODALS */}
            <PlayerPopupHost
                activeCampaign={activeCampaign}
                actor={myActor}
                character={character}
                dataActions={dataActions}
                db={db}
                notificationQueue={playerNotificationQueue}
                onClearNotification={handleClearNotification}
                xpNotification={activeCampaign?.xpNotification}
            />

            {/* Item Actions Modal */}
            {actionModal.mode !== 'SELECT_SPELL' && (
                <ItemActionsModal
                    mode={actionModal.mode}
                    item={actionModal.item}
                    characters={characters}
                    activeCharIndex={activeCharIndex}
                    onClose={() => setActionModal({ mode: null, item: null })}
                    onOpenMode={(m, i) => setActionModal({ mode: m, item: i })}
                    onBuy={executeBuy}
                    onChangeQty={executeQty}
                    onTransfer={executeTransfer}
                    onUnstack={executeUnstack}
                    onLoadSpecial={handleLoadSpecial}
                    onUnloadAll={handleUnloadAll}
                    onEditProficiency={(item) => {
                        setActionModal({ mode: null, item: null });
                        setModalData({ item, type: 'weapon_prof' }); // Reuse modalData to pass item
                        setModalMode('item_proficiencies');
                    }}
                />
            )}

            {/* Catalog Overlay */}
            {
                catalogMode === 'feat' && (
                    <LazyCatalogOverlay
                        mode="feat"
                        db={db}
                        onSelect={(item) => addToCharacter(item, 'feat')}
                        onClose={() => setCatalogMode(null)}
                    />
                )
            }

            {
                catalogMode === 'impulse' && (
                    <LazyCatalogOverlay
                        mode="impulse"
                        db={db}
                        onClose={() => setCatalogMode(null)}
                        onSelect={(item) => addToCharacter(item, 'impulse')}
                    />
                )
            }

            {
                catalogMode === 'spell' && (
                    <LazyCatalogOverlay
                        mode="spell"
                        db={db}
                        onSelect={(item) => addToCharacter(item, 'spell')}
                        onClose={() => setCatalogMode(null)}
                    />
                )
            }

            {/* Spell Scroll/Wand Selector */}
            {
                actionModal.mode === 'SELECT_SPELL' && (
                    <SpellScrollSelectorModal
                        rank={actionModal.rank}
                        type={actionModal.type}
                        db={db}
                        onCancel={() => setActionModal({ mode: null, item: null })}
                        onSelect={(spell) => {
                            const { baseItem, type, rank } = actionModal;
                            const newItem = { ...baseItem };
                            // Clone system to avoid mutation
                            newItem.system = baseItem.system ? deepClone(baseItem.system) : {};

                            // Preserve linkage to Shop Index for properties lookup
                            newItem.system.originalName = baseItem.name;

                            // Set Name
                            newItem.name = `${type === 'scroll' ? 'Scroll' : 'Wand'} of ${spell.name} (Rank ${rank})`;

                            // Embed Spell Index Entry
                            newItem.system.spell = spell;

                            // Initialize Wand Charges
                            if (type === 'wand') {
                                newItem.system.wand = { charges: 1, max: 1 };
                            }

                            // Continue to Buy Flow
                            setActionModal({ mode: 'BUY_RESTOCK', item: newItem });
                        }}
                    />
                )
            }

            {/* General Modals */}
            <ModalManager
                modalMode={modalMode}
                setModalMode={setModalMode}
                modalData={modalData}
                setModalData={setModalData}
                character={rulesCharacter}
                conditions={characterConditions}
                updateCharacter={updateCharacter}
                characterActions={characterActions}
                onClose={() => setModalMode(null)}
                onBack={handleBack}
                hasHistory={modalHistory.length > 0}
                onContentLinkClick={handleContentLinkClick}

                // Features
                dailyPrepQueue={dailyPrepQueue}
                setDailyPrepQueue={setDailyPrepQueue}
                toggleInventoryEquipped={toggleInventoryEquipped}
                isLoadingShopDetail={shopItemDetailLoading}
                shopDetailError={shopItemDetailError}

                // Callbacks
                toggleBloodmagic={toggleBloodmagic}
                removeFromCharacter={removeFromCharacter}
                saveNewAction={saveNewAction}
                onDailyPrep={performDailyPrep}
            />


            <PlayerBottomNav
                activePageId={activePageId}
                navigationContext={navigationContext}
                onSelectPage={selectPage}
                onDrawerOpenChange={setPlayerNavDrawerOpen}
                hasLoot={hasPlayerLoot}
            />
        </div>
    );
}
