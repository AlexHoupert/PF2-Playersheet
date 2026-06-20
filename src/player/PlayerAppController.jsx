import React, { useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import ShopView from './ShopView';
import { NEG_CONDS, POS_CONDS, VIS_CONDS, BINARY_CONDS, CONDITION_ICONS, getConditionIcon } from '../shared/constants/conditions';
import { conditionsCatalog, getConditionImgSrc, isConditionValued } from '../shared/constants/conditionsCatalog';
import { SPELL_INDEX_ITEMS, SPELL_INDEX_FILTER_OPTIONS } from '../shared/catalog/spellIndex';
import { FEAT_INDEX_ITEMS, FEAT_INDEX_FILTER_OPTIONS } from '../shared/catalog/featIndex';
import { getAllActionIndexItems } from '../shared/catalog/actionIndex';
import { IMPULSE_INDEX_ITEMS, IMPULSE_INDEX_FILTER_OPTIONS } from '../shared/catalog/impulseIndex';

import bloodMagicEffects from '../../ressources/classfeatures/bloodmagic-effects.json';
import ItemCatalog from './ItemCatalog';
import SpellScrollSelectorModal from './modals/SpellScrollSelectorModal';
import ItemActionsModal from './ItemActionsModal';
import QuickSheetModal from './QuickSheetModal';
import { StatBreakdown } from './components/StatBreakdown';
import { StatsView } from './views/StatsView';
import { ActionsView } from './views/ActionsView';
import { InventoryView } from './views/InventoryView';
import { MagicView } from './views/MagicView';
import { FeatsView } from './views/FeatsView';
import { ImpulsesView } from './views/ImpulsesView';
import PlayerQuestsView from './views/PlayerQuestsView';
import LoreView from './views/LoreView';
import CompanionTab from './views/CompanionTab';
import MapsView from './views/MapsView';
import ProgressView from './views/ProgressView';
import CampScreen from '../camping/CampScreen';
import PactView from '../pacts/PactView';
import { ModalManager } from './ModalManager';
import { usePlayerCatalogInspection } from './hooks/usePlayerCatalogInspection';
import { usePlayerCharacterActions } from './hooks/usePlayerCharacterActions';
import { usePlayerInventoryActions } from './hooks/usePlayerInventoryActions';
import { usePlayerModalState } from './hooks/usePlayerModalState';
import { usePlayerNavigation } from './hooks/usePlayerNavigation';
import { selectLootBagLists, selectQuestLists } from '../shared/db/selectors/campaignSelectors';
import { selectOwnedActors } from '../shared/db/selectors/actorSelectors';
import { selectConditionViewModels } from '../shared/db/selectors/effectSelectors';
// Top of file
import NotificationOverlay from './components/NotificationOverlay';
import XpOverlay from './components/XpOverlay';





const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];



export default function PlayerAppController() {
    const { activeCampaign, myActor, myCharacter, isGM, dataActions, db } = useCampaign();

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
    const { quests: playerQuests } = selectQuestLists(db, activeCampaign);
    const { lootBags: playerLootBags } = selectLootBagLists(db, activeCampaign);
    const ownedCompanionActors = selectOwnedActors(activeCampaign, myActor?.id)
        .filter(actor => ['animal_companion', 'familiar', 'pet'].includes(actor.kind));

    const {
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
    } = usePlayerNavigation({
        activeCampaign,
        db,
        hasCompanionActors: ownedCompanionActors.length > 0,
        modalMode,
        myCharacter,
    });

    const characterConditions = selectConditionViewModels(activeCampaign, myActor?.id || character?.id);

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
        <div className="app-container" ref={swipeRef} {...swipeHandlers} onClick={handleContentLinkClick}>
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
                    {/* MODE TOGGLE */}
                    <button
                        className="btn-char-switch"
                        onClick={() => {
                            const newMode = appMode === 'character' ? 'story' : 'character';
                            setAppMode(newMode);
                            // Default tabs
                            if (newMode === 'story') setActiveTab('quests');
                            else setActiveTab('stats');
                        }}
                        title={appMode === 'character' ? 'Switch to Story' : 'Switch to Character'}
                        style={{ border: '1px solid var(--border-color)', color: 'var(--text-light)' }}
                    >
                        {appMode === 'character' ? '📖' : '👤'}
                    </button>

                    {isGM && <button className="btn-char-switch" onClick={() => {
                        setActiveCharIndex((prev) => (prev + 1) % characters.length);
                    }}>👥</button>}
                    <div className="gold-display" onClick={() => setModalMode('gold')}>
                        <span>💰</span> {parseFloat(character.gold).toFixed(2)} <span className="gold-unit">gp</span>
                    </div>
                    {isGM && <button className="btn-char-switch" onClick={() => window.location.search = '?admin=true'} title="GM Screen">GM</button>}
                </div>
            </div>


            {/* TABS */}
            <div className="tabs no-swipe">
                {mainTabs.map(tab => {
                    const hasLoot = tab === 'items' && (
                        character?.inventory?.some(i => i.isLoot) ||
                        playerLootBags.some(b => !b.isLocked && (b.items || []).some(i => !i.claimedBy))
                    );
                    return (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'magic' ? 'Magic' : tab === 'impulses' ? 'Impulses' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {hasLoot && <span style={{ color: '#d32f2f', marginLeft: 5, fontWeight: 'bold' }}>!</span>}
                        </button>
                    );
                })}
            </div>

            {/* VIEW CONTENT */}
            <div className="view-section">
                {activeTab === 'stats' && (
                    <StatsView
                        character={character}
                        conditions={characterConditions}
                        updateCharacter={updateCharacter}
                        onOpenModal={(mode, data) => {
                            setModalMode(mode);
                            if (data) setModalData(data);
                        }}
                        onLongPress={handleLongPress}
                    />
                )}

                {activeTab === 'quests' && (
                    <PlayerQuestsView quests={playerQuests} />
                )}

                {activeTab === 'lore' && (
                    <LoreView db={db} />
                )}

                {activeTab === 'actions' && (
                    <ActionsView
                        character={character}
                        onOpenModal={(mode, data) => {
                            setModalMode(mode);
                            setModalData(data);
                        }}
                        onLongPress={(item, type) => handleLongPress(item, type)}
                    />
                )}

                {activeTab === 'magic' && (
                    <MagicView
                        character={character}
                        updateCharacter={updateCharacter}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={setCatalogMode}
                        onLongPress={handleLongPress}
                    />
                )}
                {activeTab === 'impulses' && (
                    <ImpulsesView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        onLongPress={handleLongPress}
                    />
                )}
                {activeTab === 'feats' && (
                    <FeatsView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={setCatalogMode}
                        onLongPress={handleLongPress}
                    />
                )}

                {activeTab === 'maps' && <MapsView />}
                {activeTab === 'progress' && <ProgressView />}
                {activeTab === 'camp' && <CampScreen />}
                {activeTab === 'companion' && (
                    <CompanionTab
                        character={character}
                        ownerActor={myActor}
                        companionActors={ownedCompanionActors}
                        dataActions={dataActions}
                        activeCampaignId={activeCampaign?.id}
                    />
                )}
                {activeTab === 'pact' && <PactView character={character} db={db} />}
            </div>

            {/* MODALS / FULL PAGE VIEWS */}

            {
                activeTab === 'items' && (
                    <div>
                        <InventoryView
                            character={character}
                            db={db}
                            onUpdateCharacter={updateCharacter}
                            onSaveCustomItem={(dbItem) => runDataAction(dataActions.globalContent.saveCustomItem(dbItem))}
                            onOpenModal={(mode, data) => {
                                setModalMode(mode);
                                setModalData(data);
                            }}
                            onInspectItem={inspectInventoryItem}
                            onConsumeItem={handleConsumeItem}
                            onToggleEquip={toggleInventoryEquipped}
                            onFireWeapon={fireWeapon}
                            onLoadWeapon={loadWeapon}
                            onLongPress={handleLongPress}
                            onClaimLoot={(bag, item) => {
                                if (!activeCampaign?.id || !character?.id) return;
                                runDataAction(dataActions.loot.claimItem(activeCampaign.id, bag.id, item, character.id));
                            }}
                            onClaimGold={(bagId, amount) => {
                                if (!activeCampaign?.id || !character?.id) return;
                                runDataAction(dataActions.loot.claimGold(activeCampaign.id, bagId, character.id, amount));
                            }}
                            onSplitGold={(bagId) => {
                                if (!activeCampaign?.id) return;
                                runDataAction(dataActions.loot.splitGold(activeCampaign.id, bagId));
                            }}
                            onOpenShop={() => setActiveTab('shop')}
                        />
                    </div>
                )
            }

            {
                activeTab === 'shop' && (
                    <ShopView
                        db={db}
                        onInspectItem={(item) => {
                            setModalData(item);
                            setModalMode('item');
                        }}
                        onBuyItem={(item) => {
                            const scrollMatch = item.name.match(/(?:Scroll of Rank (\d+)|Scroll of (\d+)(?:st|nd|rd|th)?-rank Spell)/i);
                            const wandMatch = item.name.match(/(?:Wand of Rank (\d+)|Magic Wand \((\d+)(?:st|nd|rd|th)?-Rank Spell\))/i);

                            if (scrollMatch) {
                                setActionModal({ mode: 'SELECT_SPELL', rank: parseInt(scrollMatch[1] || scrollMatch[2]), type: 'scroll', baseItem: item });
                            } else if (wandMatch) {
                                setActionModal({ mode: 'SELECT_SPELL', rank: parseInt(wandMatch[1] || wandMatch[2]), type: 'wand', baseItem: item });
                            } else {
                                setActionModal({ mode: 'BUY_RESTOCK', item });
                            }
                        }}
                        onBuyFormula={handleBuyFormula}
                        knownFormulas={character.formulaBook || []}
                    />
                )
            }

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
                    <ItemCatalog
                        title="Add Feat"
                        items={FEAT_INDEX_ITEMS}
                        filterOptions={FEAT_INDEX_FILTER_OPTIONS}
                        onSelect={(item) => addToCharacter(item, 'feat')}
                        onClose={() => setCatalogMode(null)}
                    />
                )
            }

            {
                catalogMode === 'impulse' && (
                    <ItemCatalog
                        title="Add Impulse"
                        items={IMPULSE_INDEX_ITEMS}
                        filterOptions={IMPULSE_INDEX_FILTER_OPTIONS}
                        onClose={() => setCatalogMode(null)}
                        onSelect={(impulseData) => {
                            updateCharacter(c => {
                                if (!c.impulses) c.impulses = [];
                                c.impulses.push(impulseData);
                            });
                            setCatalogMode(null);
                        }}
                    />
                )
            }

            {
                catalogMode === 'spell' && (
                    <ItemCatalog
                        title="Add Spell"
                        items={SPELL_INDEX_ITEMS}
                        filterOptions={SPELL_INDEX_FILTER_OPTIONS}
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
                        onCancel={() => setActionModal({ mode: null, item: null })}
                        onSelect={(spell) => {
                            const { baseItem, type, rank } = actionModal;
                            const newItem = { ...baseItem };
                            // Clone system to avoid mutation
                            newItem.system = baseItem.system ? JSON.parse(JSON.stringify(baseItem.system)) : {};

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
                character={character}
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


            {/* Notification Overlay */}
            <NotificationOverlay
                queue={[...(activeCampaign?.notificationQueue || []), ...(db.notificationQueue || [])]}
                onClear={handleClearNotification}
            />

            {/* XP Overlay */}
            <XpOverlay xpNotification={activeCampaign?.xpNotification} />
        </div>
    );
}
