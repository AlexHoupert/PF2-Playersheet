/**
 * EncounterView – GM encounter management tab.
 * Layout: collapsible sidebar | initiative tracker | info panel
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../shared/context/CampaignContext';
import { deepClone } from '../shared/utils/deepClone';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';
import CreatureCard from '../shared/components/CreatureCard';
import BottomSheet from '../shared/components/BottomSheet';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { CharacterCard } from './components/CharacterCard';
import InitiativeCard from './components/InitiativeCard';
import './EncounterView.css';

// ── helpers ──
function uuid() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

function makeEncounter(name) {
    return { id: uuid(), name, isActive: false, currentTurnIndex: 0, selectedEntityId: null, combatants: [] };
}

function makeCombatant(type, data) {
    if (type === 'player') {
        const maxHp = data.stats?.hp?.max ?? data.hp?.max ?? 0;
        const currentHp = data.stats?.hp?.current ?? data.hp?.current ?? maxHp;
        return {
            id: uuid(), type: 'player', playerId: data.id, creatureId: null,
            name: data.name, instanceLabel: 1,
            initiative: 0, currentHp, maxHp, conditions: [], visible: true,
        };
    }
    // creature
    const hp = data?.system?.attributes?.hp?.max ?? data?.hp?.max ?? 0;
    return {
        id: uuid(), type: 'creature', creatureId: data._catalogId || data.id || data.name,
        name: data.name, unknownName: data.unknownName || '???', instanceLabel: 1,
        initiative: 0, currentHp: hp, maxHp: hp, conditions: [], visible: true, playerId: null,
    };
}

export default function EncounterView({ db, setDb }) {
    const { activeCampaign, activeCampaignId, dataActions } = useCampaign();
    const { isMobile } = useWindowSize();

    // Local UI state
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [creatureSearch, setCreatureSearch] = useState('');
    const [creatureDataCache, setCreatureDataCache] = useState({});

    const encounters = activeCampaign?.encounters || [];
    const archivedEncounters = activeCampaign?.archivedEncounters || [];
    const characters = activeCampaign?.characters || [];
    const activeEncounter = encounters.find(e => e.isActive) || null;

    // Selected encounter for sidebar editing (doesn't have to be active)
    const [selectedEncounterId, setSelectedEncounterId] = useState(null);
    const selectedEncounter = encounters.find(e => e.id === selectedEncounterId) || activeEncounter;

    // Which combatant is selected for the info panel
    const selectedEntityId = activeEncounter?.selectedEntityId || null;

    // ── Creature catalog for search (static index + custom creatures from DB) ──
    const allCreatures = useMemo(() => {
        const indexed = getAllCreatures();
        const custom = Object.values(db?.bestiary?.customCreatures || {}).map(c => ({
            id: c.id,
            name: c.name,
            level: c.data?.system?.details?.level?.value ?? 0,
            type: c.type || 'npc',
            img: c.data?.img || '',
            rarity: c.data?.system?.traits?.rarity || 'common',
            size: c.data?.system?.traits?.size?.value || 'med',
            traits: c.data?.system?.traits?.value || [],
            isCustom: true,
        }));
        // Custom creatures first, then deduplicate static ones by name
        const customNames = new Set(custom.map(c => c.name));
        return [...custom, ...indexed.filter(c => !customNames.has(c.name))];
    }, [db?.bestiary?.customCreatures]);

    const filteredCreatures = useMemo(() => {
        if (!creatureSearch || creatureSearch.length < 2) return [];
        const q = creatureSearch.toLowerCase();
        return allCreatures.filter(c => c.name && c.name.toLowerCase().includes(q)).slice(0, 20);
    }, [creatureSearch, allCreatures]);

    // ── Load creature data for info panel ──
    useEffect(() => {
        if (!activeEncounter) return;
        activeEncounter.combatants
            .filter(c => c.type === 'creature' && c.creatureId && !creatureDataCache[c.creatureId])
            .forEach(c => {
                // Check custom creatures first (synchronous, no fetch needed)
                const customData = db?.bestiary?.customCreatures?.[c.creatureId]?.data;
                if (customData) {
                    setCreatureDataCache(prev => ({ ...prev, [c.creatureId]: customData }));
                    return;
                }
                fetchCreatureData(c.creatureId).then(data => {
                    if (data) setCreatureDataCache(prev => ({ ...prev, [c.creatureId]: data }));
                });
            });
    }, [activeEncounter?.combatants?.length]);

    // ── Domain action runner ──
    const runEncounterAction = useCallback((action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    }, []);

    const requireCampaignId = useCallback(() => {
        if (!activeCampaignId) {
            alert('No active campaign selected.');
            return null;
        }
        return activeCampaignId;
    }, [activeCampaignId]);

    // ── Encounter CRUD ──
    const createEncounter = () => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        const name = prompt('Encounter name:');
        if (!name) return;
        const action = dataActions.encounter.createEncounter(campaignId, name).then(id => {
            if (id) setSelectedEncounterId(id);
        });
        runEncounterAction(action);
    };

    const deleteEncounter = (id) => {
        const campaignId = requireCampaignId();
        if (!campaignId || !confirm('Archive this encounter?')) return;
        runEncounterAction(dataActions.encounter.softDeleteEncounter(campaignId, id));
        if (selectedEncounterId === id) setSelectedEncounterId(null);
    };

    const restoreEncounter = (id) => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.restoreEncounter(campaignId, id));
    };

    const activateEncounter = (id) => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.activateEncounter(campaignId, id));
    };

    // ── Combatant management ──
    const addCreatureToEncounter = (encId, catalogEntry) => {
        const applyData = (data) => {
            const campaignId = requireCampaignId();
            if (!campaignId) return;
            data._catalogId = catalogEntry.id;
            runEncounterAction(dataActions.encounter.addCombatant(campaignId, encId, 'creature', data));
            setCreatureDataCache(prev => ({ ...prev, [catalogEntry.id]: data }));
        };

        if (catalogEntry.isCustom) {
            // Custom creatures are already in DB — no async fetch needed
            const customData = db?.bestiary?.customCreatures?.[catalogEntry.id]?.data;
            if (customData) applyData(deepClone(customData));
            return;
        }

        fetchCreatureData(catalogEntry.id).then(data => {
            if (data) applyData(data);
        });
    };

    const addAllPlayers = (encId) => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.addAllPlayers(campaignId, encId));
    };

    const removeCombatant = (encId, combatantId) => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.removeCombatant(campaignId, encId, combatantId));
    };

    const toggleVisibility = (encId, combatantId) => {
        const campaignId = requireCampaignId();
        const encounter = encounters.find(enc => enc.id === encId);
        const combatant = encounter?.combatants?.find(c => c.id === combatantId);
        if (!campaignId || !combatant) return;
        runEncounterAction(dataActions.encounter.updateCombatant(campaignId, encId, combatantId, {
            visible: !combatant.visible,
        }));
    };

    const setInitiative = (combatantId, value) => {
        if (!activeEncounter) return;
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.updateCombatant(campaignId, activeEncounter.id, combatantId, {
            initiative: value,
        }));
    };

    const setHp = (combatantId, value) => {
        if (!activeEncounter) return;
        const campaignId = requireCampaignId();
        const combatant = activeEncounter.combatants.find(c => c.id === combatantId);
        if (!campaignId || !combatant) return;
        runEncounterAction(dataActions.encounter.updateCombatant(campaignId, activeEncounter.id, combatantId, {
            currentHp: Math.max(0, Math.min(value, combatant.maxHp)),
        }));
    };

    const selectEntity = (entityId) => {
        if (!activeEncounter) return;
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.selectEntity(campaignId, activeEncounter.id, entityId));
    };

    // ── Turn management ──
    // Initiative-sorted, then rotated so the active combatant is always first (top of list).
    const sortedCombatants = useMemo(() => {
        if (!activeEncounter) return [];
        const byInit = [...activeEncounter.combatants].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        const idx = (activeEncounter.currentTurnIndex ?? 0) % (byInit.length || 1);
        return [...byInit.slice(idx), ...byInit.slice(0, idx)];
    }, [activeEncounter?.combatants, activeEncounter?.currentTurnIndex]);

    const endTurn = () => {
        if (!activeEncounter) return;
        const total = activeEncounter.combatants.length;
        if (total === 0) return;
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.endTurn(campaignId, activeEncounter.id));
    };

    const resetRound = () => {
        if (!activeEncounter) return;
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.resetRound(campaignId, activeEncounter.id));
    };

    const rollInitiativeAll = () => {
        if (!activeEncounter) return;
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        runEncounterAction(dataActions.encounter.rollInitiativeAll(campaignId, activeEncounter.id, creatureDataCache));
    };

    // Active combatant is always the first in the rotated list
    const activeTurnId = sortedCombatants[0]?.id;

    // ── Context menu ──
    const handleCardContext = (e, combatant) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, combatant });
    };

    const closeContextMenu = () => setContextMenu(null);

    // ── Info panel data ──
    const selectedCombatant = activeEncounter?.combatants?.find(c => c.id === selectedEntityId);
    const infoCreatureData = selectedCombatant?.type === 'creature' ? creatureDataCache[selectedCombatant.creatureId] : null;
    const infoCharData = selectedCombatant?.type === 'player' ? characters.find(c => c.id === selectedCombatant.playerId) : null;

    // Reveal state for creature cards
    const getRevealState = (creatureId) => {
        return db?.bestiary?.creatures?.[creatureId]?.revealState || {};
    };

    // ── Open Party Screen ──
    const openPartyScreen = () => {
        window.open('?party=true', 'pf2e-party', 'width=1200,height=800');
    };

    // Close context menu on click
    useEffect(() => {
        const handler = () => closeContextMenu();
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    // ── Info panel body (shared between desktop panel and mobile BottomSheet) ──
    const infoPanelBody = selectedCombatant ? (
        <div className="enc-info-panel__body">
            {selectedCombatant.type === 'creature' && infoCreatureData && (
                <CreatureCard
                    creature={infoCreatureData}
                    isGM={true}
                    revealState={getRevealState(selectedCombatant.creatureId)}
                    onRevealChange={(field, mode) => {
                        setDb(prev => {
                            const next = deepClone(prev);
                            if (!next.bestiary) next.bestiary = { creatures: {} };
                            if (!next.bestiary.creatures) next.bestiary.creatures = {};
                            if (!next.bestiary.creatures[selectedCombatant.creatureId]) {
                                next.bestiary.creatures[selectedCombatant.creatureId] = { revealState: {} };
                            }
                            next.bestiary.creatures[selectedCombatant.creatureId].revealState[field] = mode;
                            return next;
                        });
                    }}
                />
            )}
            {selectedCombatant.type === 'creature' && !infoCreatureData && (
                <div className="enc-info-panel__loading">Loading creature data...</div>
            )}
            {selectedCombatant.type === 'player' && infoCharData && (
                <CharacterCard
                    character={infoCharData}
                    db={db}
                    setDb={setDb}
                    updateCharacter={(fn) => {
                        const campaignId = requireCampaignId();
                        if (!campaignId) return;
                        runEncounterAction(dataActions.character.updateCharacter(campaignId, infoCharData.id, fn));
                    }}
                    setModalMode={() => { }}
                    setModalData={() => { }}
                />
            )}
            {selectedCombatant.type === 'player' && !infoCharData && (
                <div className="enc-info-panel__loading">Player data not found.</div>
            )}
        </div>
    ) : null;

    // ── Sidebar body (shared between desktop and mobile BottomSheet) ──────────
    const sidebarBody = (
        <>
            <div className="enc-sidebar__header">
                <h3>Encounters</h3>
                <button className="enc-btn enc-btn--small" onClick={createEncounter} title="New Encounter">＋</button>
            </div>
            <div className="enc-sidebar__list">
                {encounters.map(enc => (
                    <div
                        key={enc.id}
                        className={`enc-sidebar__item ${enc.id === selectedEncounterId ? 'enc-sidebar__item--selected' : ''} ${enc.isActive ? 'enc-sidebar__item--active' : ''}`}
                        onClick={() => setSelectedEncounterId(enc.id)}
                        onContextMenu={(e) => { e.preventDefault(); deleteEncounter(enc.id); }}
                    >
                        <span className="enc-sidebar__item-name">
                            {enc.isActive && <span className="enc-sidebar__active-dot">●</span>}
                            {enc.name}
                        </span>
                        <span className="enc-sidebar__item-count">{enc.combatants.length}</span>
                    </div>
                ))}
                {encounters.length === 0 && <div className="enc-sidebar__empty">No encounters yet</div>}
            </div>
            {archivedEncounters.length > 0 && (
                <div className="enc-sidebar__list" style={{ borderTop: '1px solid #333', marginTop: 12, paddingTop: 12 }}>
                    <div style={{ color: '#888', fontSize: '0.8em', textTransform: 'uppercase', marginBottom: 6 }}>Archived</div>
                    {archivedEncounters.map(enc => (
                        <div key={enc.id} className="enc-sidebar__item" style={{ opacity: 0.75 }}>
                            <span className="enc-sidebar__item-name">{enc.name}</span>
                            <button className="enc-btn enc-btn--tiny" onClick={() => restoreEncounter(enc.id)}>Restore</button>
                        </div>
                    ))}
                </div>
            )}
            {selectedEncounter && (
                <div className="enc-sidebar__manage">
                    <div className="enc-sidebar__manage-header">
                        <h4>{selectedEncounter.name}</h4>
                        <div className="enc-sidebar__manage-actions">
                            {!selectedEncounter.isActive && (
                                <button className="enc-btn enc-btn--gold" onClick={() => activateEncounter(selectedEncounter.id)}>
                                    ▶ Activate
                                </button>
                            )}
                            <button className="enc-btn enc-btn--small" onClick={() => addAllPlayers(selectedEncounter.id)} title="Add all players">
                                👥+
                            </button>
                        </div>
                    </div>
                    <div className="enc-sidebar__combatants">
                        {selectedEncounter.combatants.map(c => (
                            <div key={c.id} className="enc-sidebar__combatant">
                                <span>{c.type === 'player' ? '🧑' : '👹'} {c.name}{c.instanceLabel > 1 ? ` #${c.instanceLabel}` : ''}</span>
                                <button className="enc-btn enc-btn--tiny enc-btn--danger" onClick={() => removeCombatant(selectedEncounter.id, c.id)}>✕</button>
                            </div>
                        ))}
                    </div>
                    <div className="enc-sidebar__search">
                        <input
                            className="enc-search-input"
                            placeholder="Search creatures..."
                            value={creatureSearch}
                            onChange={(e) => setCreatureSearch(e.target.value)}
                        />
                        {filteredCreatures.length > 0 && (
                            <div className="enc-sidebar__search-results">
                                {filteredCreatures.map(c => (
                                    <div
                                        key={c.id}
                                        className="enc-sidebar__search-item"
                                        onClick={() => { addCreatureToEncounter(selectedEncounter.id, c); setCreatureSearch(''); }}
                                    >
                                        <span>
                                            {c.name}
                                            {c.isCustom && <span style={{ marginLeft: 5, fontSize: '0.72em', color: '#c5a059' }}>✦</span>}
                                        </span>
                                        <span className="enc-sidebar__search-level">Lv {c.level}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    // ═══════════════════════ RENDER ═══════════════════════
    return (
        <div className="encounter-view" onClick={closeContextMenu}>
            {/* ── SIDEBAR: desktop inline, mobile BottomSheet ── */}
            {!isMobile && sidebarOpen && (
                <div className="enc-sidebar">{sidebarBody}</div>
            )}

            {/* ── MAIN AREA ── */}
            <div className="enc-main">
                <div className="enc-toolbar">
                    <button className="enc-btn enc-btn--small" onClick={() => isMobile ? setMobileSidebarOpen(true) : setSidebarOpen(!sidebarOpen)}>
                        ☰
                    </button>
                    {activeEncounter && (
                        <>
                            <h2 className="enc-toolbar__title">{activeEncounter.name}</h2>
                            <div className="enc-toolbar__actions">
                                <button className="enc-btn enc-btn--gold" onClick={endTurn}>End Turn ⏭</button>
                                <button className="enc-btn enc-btn--small" onClick={resetRound} title="Reset to top of round">↺</button>
                                <button className="enc-btn enc-btn--small" onClick={rollInitiativeAll} title="Roll initiative for all creatures (d20 + Perception)">🎲</button>
                                {!isMobile && <button className="enc-btn enc-btn--small" onClick={openPartyScreen} title="Open Party Screen">📺</button>}
                            </div>
                        </>
                    )}
                    {!activeEncounter && <span className="enc-toolbar__hint">No active encounter — open the sidebar to select one.</span>}
                </div>

                {activeEncounter && (
                    <div className="enc-tracker">
                        <AnimatePresence mode="popLayout">
                            {sortedCombatants.map((combatant) => (
                                <InitiativeCard
                                    key={combatant.id}
                                    combatant={combatant}
                                    isActive={combatant.id === activeTurnId}
                                    isSelected={combatant.id === selectedEntityId}
                                    isGM={true}
                                    onClick={selectEntity}
                                    onContextMenu={handleCardContext}
                                    onInitiativeChange={setInitiative}
                                    onHpChange={setHp}
                                    creatureData={combatant.type === 'creature' ? creatureDataCache[combatant.creatureId] : null}
                                    characterData={combatant.type === 'player' ? characters.find(c => c.id === combatant.playerId) : null}
                                />
                            ))}
                        </AnimatePresence>
                        {sortedCombatants.length === 0 && (
                            <div className="enc-tracker__empty">No combatants. Add creatures or players from the sidebar.</div>
                        )}
                    </div>
                )}
            </div>

            {/* ── INFO PANEL: desktop inline, mobile BottomSheet ── */}
            {activeEncounter && selectedCombatant && !isMobile && (
                <div className="enc-info-panel">
                    <div className="enc-info-panel__header">
                        <h3>{selectedCombatant.name}</h3>
                        <button className="enc-btn enc-btn--small" onClick={() => selectEntity(null)}>✕</button>
                    </div>
                    {infoPanelBody}
                </div>
            )}

            {/* ── Mobile BottomSheets ── */}
            {isMobile && (
                <>
                    <BottomSheet isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} title="Encounters" height="85vh">
                        <div style={{ overflowY: 'auto', height: '100%' }}>{sidebarBody}</div>
                    </BottomSheet>
                    <BottomSheet isOpen={!!selectedCombatant} onClose={() => selectEntity(null)} title={selectedCombatant?.name || ''} height="85vh">
                        {infoPanelBody}
                    </BottomSheet>
                </>
            )}

            {/* ── Context Menu ── */}
            {contextMenu && (
                <div
                    className="enc-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={() => { toggleVisibility(activeEncounter.id, contextMenu.combatant.id); closeContextMenu(); }}>
                        {contextMenu.combatant.visible ? '👁️ Hide from party' : '👁️ Show to party'}
                    </button>
                    <button onClick={() => { removeCombatant(activeEncounter.id, contextMenu.combatant.id); closeContextMenu(); }}>
                        🗑️ Remove
                    </button>
                    <button onClick={() => {
                        const val = prompt('Set initiative:', contextMenu.combatant.initiative);
                        if (val !== null) { setInitiative(contextMenu.combatant.id, parseFloat(val) || 0); }
                        closeContextMenu();
                    }}>
                        🎲 Set Initiative
                    </button>
                    {contextMenu.combatant.type === 'creature' && (
                        <button onClick={() => {
                            const cond = prompt('Add condition (e.g. Poisoned, Off-Guard):');
                            if (cond) {
                                const campaignId = requireCampaignId();
                                if (campaignId) {
                                    runEncounterAction(dataActions.encounter.addCondition(
                                        campaignId,
                                        activeEncounter.id,
                                        contextMenu.combatant.id,
                                        cond
                                    ));
                                }
                            }
                            closeContextMenu();
                        }}>
                            🏷️ Add Condition
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
