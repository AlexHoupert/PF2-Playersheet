/**
 * EncounterView – GM encounter management tab.
 * Layout: collapsible sidebar | initiative tracker | info panel
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { deepClone } from '../shared/utils/deepClone';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';
import { selectBestiaryRevealState, selectCustomCreatureData } from '../shared/db/selectors/bestiarySelectors';
import { selectActiveCharacters } from '../shared/db/selectors/characterSelectors';
import {
    getCombatantEffectTargetId,
    selectCombatantEffectPresentationItems,
    selectCombatantEffects
} from '../shared/db/selectors/effectSelectors';
import { getRotatedEncounterTurnOrder } from '../shared/encounter/turnOrder';
import {
    buildEncounterCreatureCatalog,
    mergeEncounterCreatureData,
    resolveEncounterCreatureStaticId,
} from '../shared/encounter/encounterCreatureCatalog';
import BottomSheet from '../shared/components/BottomSheet';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import InitiativeCard from './components/InitiativeCard';
import EncounterEffectDialogs from './encounter/EncounterEffectDialogs';
import { EncounterInfoPanel, EncounterSidebar } from './encounter/EncounterPanels';
import './EncounterView.css';

export default function EncounterView({ db }) {
    const { activeCampaign, activeCampaignId, dataActions } = useCampaign();
    const { confirm, notifyError, prompt } = useAppFeedback();
    const { isMobile } = useWindowSize();

    // Local UI state
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [effectDialog, setEffectDialog] = useState(null);
    const [creatureSearch, setCreatureSearch] = useState('');
    const [creatureDataCache, setCreatureDataCache] = useState({});

    const encounters = activeCampaign?.encounters || [];
    const archivedEncounters = activeCampaign?.archivedEncounters || [];
    const characters = useMemo(() => selectActiveCharacters(activeCampaign), [activeCampaign]);
    const activeEncounter = encounters.find(e => e.isActive) || null;

    // Selected encounter for sidebar editing (doesn't have to be active)
    const [selectedEncounterId, setSelectedEncounterId] = useState(null);
    const selectedEncounter = encounters.find(e => e.id === selectedEncounterId) || activeEncounter;

    // Which combatant is selected for the info panel
    const selectedEntityId = activeEncounter?.selectedEntityId || null;

    // ── Creature catalog for search (static index + custom creatures from DB) ──
    const staticCreatures = useMemo(() => getAllCreatures(), []);
    const allCreatures = useMemo(
        () => buildEncounterCreatureCatalog(staticCreatures, db),
        [db, staticCreatures]
    );

    const filteredCreatures = useMemo(() => {
        if (!creatureSearch || creatureSearch.length < 2) return [];
        const q = creatureSearch.toLowerCase();
        return allCreatures.filter(c => c.name && c.name.toLowerCase().includes(q)).slice(0, 20);
    }, [creatureSearch, allCreatures]);

    // ── Load creature data for info panel ──
    const loadCreatureData = useCallback(async (catalogEntry) => {
        if (!catalogEntry) return null;
        const legacyCustomData = selectCustomCreatureData(db, catalogEntry.id);
        const staticId = resolveEncounterCreatureStaticId(catalogEntry, staticCreatures);
        const staticData = staticId ? await fetchCreatureData(staticId) : null;
        return mergeEncounterCreatureData(catalogEntry, staticData || legacyCustomData);
    }, [db, staticCreatures]);

    useEffect(() => {
        if (!activeEncounter) return;
        let cancelled = false;
        const pending = activeEncounter.combatants
            .filter(c => c.type === 'creature' && c.creatureId && !creatureDataCache[c.creatureId])
            .map(async (combatant) => {
                const catalogEntry = allCreatures.find((creature) => creature.id === combatant.creatureId)
                    || { id: combatant.creatureId, data: selectCustomCreatureData(db, combatant.creatureId) };
                const data = await loadCreatureData(catalogEntry);
                return data ? [combatant.creatureId, data] : null;
            });
        Promise.all(pending).then((loaded) => {
            if (cancelled) return;
            const entries = loaded.filter(Boolean);
            if (entries.length > 0) {
                setCreatureDataCache((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
            }
        });
        return () => { cancelled = true; };
    }, [activeEncounter, allCreatures, creatureDataCache, db, loadCreatureData]);

    // ── Domain action runner ──
    const runEncounterAction = useCallback((action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    }, [notifyError]);

    const requireCampaignId = useCallback(() => {
        if (!activeCampaignId) {
            notifyError('No active campaign selected.');
            return null;
        }
        return activeCampaignId;
    }, [activeCampaignId, notifyError]);

    // ── Encounter CRUD ──
    const createEncounter = async () => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        const name = await prompt({
            title: 'Create encounter',
            message: 'Encounter name:',
            inputLabel: 'Name',
            confirmLabel: 'Create',
        });
        if (!name) return;
        const action = dataActions.encounter.createEncounter(campaignId, name).then(id => {
            if (id) setSelectedEncounterId(id);
        });
        runEncounterAction(action);
    };

    const deleteEncounter = async (id) => {
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        const confirmed = await confirm({
            title: 'Archive encounter',
            message: 'Archive this encounter?',
            confirmLabel: 'Archive',
            danger: true,
        });
        if (!confirmed) return;
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
    const addCreatureToEncounter = async (encId, catalogEntry) => {
        const applyData = (data) => {
            const campaignId = requireCampaignId();
            if (!campaignId) return;
            data._catalogId = catalogEntry.id;
            runEncounterAction(dataActions.encounter.addCombatant(campaignId, encId, 'creature', data));
            setCreatureDataCache(prev => ({ ...prev, [catalogEntry.id]: data }));
        };

        const data = await loadCreatureData(catalogEntry);
        if (data) applyData(deepClone(data));
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

    const promptForInitiative = async (combatant) => {
        const val = await prompt({
            title: 'Set initiative',
            inputLabel: 'Initiative',
            inputType: 'number',
            initialValue: combatant?.initiative ?? 0,
            confirmLabel: 'Set',
        });
        if (val === null || val === '') return;
        setInitiative(combatant.id, parseFloat(val) || 0);
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
    const sortedCombatants = useMemo(() => {
        if (!activeEncounter) return [];
        return getRotatedEncounterTurnOrder(activeEncounter);
    }, [activeEncounter]);
    const eligibleTurnCombatants = useMemo(() => {
        if (!activeEncounter) return [];
        return getRotatedEncounterTurnOrder(activeEncounter, { includeDefeated: false });
    }, [activeEncounter]);

    const endTurn = () => {
        if (!activeEncounter) return;
        if (eligibleTurnCombatants.length === 0) return;
        const campaignId = requireCampaignId();
        if (!campaignId) return;
        const currentCombatant = eligibleTurnCombatants[0];
        const nextCombatant = eligibleTurnCombatants[1] || eligibleTurnCombatants[0];
        const turnSequence = Number(activeEncounter.turnSequence) || 0;
        const currentTargetId = getCombatantEffectTargetId(activeEncounter.id, currentCombatant);
        const nextTargetId = getCombatantEffectTargetId(activeEncounter.id, nextCombatant);
        runEncounterAction((async () => {
            if (currentTargetId) {
                await dataActions.effect.advanceDuration(campaignId, currentTargetId, {
                    tick: 'turn_end',
                    tickKey: `${activeEncounter.id}:turn:${turnSequence}:end:${currentTargetId}`,
                });
            }
            await dataActions.encounter.endTurn(campaignId, activeEncounter.id);
            if (nextTargetId) {
                await dataActions.effect.advanceDuration(campaignId, nextTargetId, {
                    tick: 'turn_start',
                    tickKey: `${activeEncounter.id}:turn:${turnSequence + 1}:start:${nextTargetId}`,
                });
            }
        })());
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

    const openEffectDialog = (mode) => {
        if (!contextMenu?.combatant) return;
        setEffectDialog({ mode, combatant: contextMenu.combatant });
        closeContextMenu();
    };

    const getEffectTargetId = (combatant) => getCombatantEffectTargetId(activeEncounter?.id, combatant);

    const addEffectToCombatant = (factory) => {
        const campaignId = requireCampaignId();
        const targetActorId = getEffectTargetId(effectDialog?.combatant);
        if (!campaignId || !targetActorId) return;
        runEncounterAction(factory(campaignId, targetActorId));
    };

    const addStandardConditionToCombatant = (conditionName, value, visibilityOptions = {}) => {
        addEffectToCombatant((campaignId, targetActorId) =>
            dataActions.effect.createStandardCondition(campaignId, targetActorId, conditionName, value, {
                sourceType: 'encounter',
                sourceId: activeEncounter?.id,
                sourceName: conditionName,
                hidden: Boolean(visibilityOptions.hidden),
            })
        );
    };

    const addPersistentDamageToCombatant = (payload, visibilityOptions = {}) => {
        addEffectToCombatant((campaignId, targetActorId) =>
            dataActions.effect.createPersistentDamage(campaignId, targetActorId, payload, {
                sourceType: 'encounter',
                sourceId: activeEncounter?.id,
                sourceName: 'Persistent Damage',
                hidden: Boolean(visibilityOptions.hidden),
            })
        );
    };

    const addCustomBadgeToCombatant = (label, visibilityOptions = {}) => {
        addEffectToCombatant((campaignId, targetActorId) =>
            dataActions.effect.createCustomBadge(campaignId, targetActorId, label, {
                sourceType: 'encounter',
                sourceId: activeEncounter?.id,
                sourceName: label,
                hidden: Boolean(visibilityOptions.hidden),
            })
        );
    };

    const setCombatantDefeated = (combatant) => {
        const campaignId = requireCampaignId();
        if (!campaignId || !activeEncounter || combatant?.type !== 'creature') return;
        runEncounterAction(dataActions.encounter.setCombatantDefeated(campaignId, activeEncounter.id, combatant.id));
        closeContextMenu();
    };

    const removeEffectFromCombatant = (effectId) => {
        const campaignId = requireCampaignId();
        if (!campaignId || !effectId) return;
        runEncounterAction(dataActions.effect.deleteEffect(campaignId, effectId));
    };

    // ── Info panel data ──
    const selectedCombatant = activeEncounter?.combatants?.find(c => c.id === selectedEntityId);
    const infoCreatureData = selectedCombatant?.type === 'creature' ? creatureDataCache[selectedCombatant.creatureId] : null;
    const infoCharData = selectedCombatant?.type === 'player' ? characters.find(c => c.id === selectedCombatant.playerId) : null;

    // Reveal state for creature cards
    const getRevealState = (creatureId) => {
        return selectBestiaryRevealState(db, creatureId);
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

    const infoPanelBody = (
        <EncounterInfoPanel
            db={db}
            infoCharData={infoCharData}
            infoCreatureData={infoCreatureData}
            selectedCombatant={selectedCombatant}
            getRevealState={getRevealState}
            onRevealChange={(field, mode) => {
                runEncounterAction(dataActions.bestiary.updateRevealState(selectedCombatant.creatureId, field, mode));
            }}
            onUpdateCharacter={(fn) => {
                const campaignId = requireCampaignId();
                if (!campaignId) return;
                runEncounterAction(dataActions.character.updateCharacter(campaignId, infoCharData.id, fn));
            }}
        />
    );

    const sidebarBody = (
        <EncounterSidebar
            activateEncounter={activateEncounter}
            addAllPlayers={addAllPlayers}
            addCreatureToEncounter={addCreatureToEncounter}
            archivedEncounters={archivedEncounters}
            createEncounter={createEncounter}
            creatureSearch={creatureSearch}
            deleteEncounter={deleteEncounter}
            encounters={encounters}
            filteredCreatures={filteredCreatures}
            removeCombatant={removeCombatant}
            restoreEncounter={restoreEncounter}
            selectedEncounter={selectedEncounter}
            selectedEncounterId={selectedEncounterId}
            setCreatureSearch={setCreatureSearch}
            setSelectedEncounterId={setSelectedEncounterId}
        />
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
                                    onEffectRemove={removeEffectFromCombatant}
                                    creatureData={combatant.type === 'creature' ? creatureDataCache[combatant.creatureId] : null}
                                    characterData={combatant.type === 'player' ? characters.find(c => c.id === combatant.playerId) : null}
                                    combatantEffects={selectCombatantEffects(activeCampaign, activeEncounter.id, combatant)}
                                    effectBadges={selectCombatantEffectPresentationItems(activeCampaign, activeEncounter.id, combatant)}
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
                    data-testid="encounter-context-menu"
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
                        promptForInitiative(contextMenu.combatant);
                        closeContextMenu();
                    }}>
                        🎲 Set Initiative
                    </button>
                    {contextMenu.combatant.type === 'creature' && !contextMenu.combatant.defeatedAt && (
                        <button data-testid="encounter-set-defeated" onClick={() => setCombatantDefeated(contextMenu.combatant)}>
                            ☠ Set Defeated
                        </button>
                    )}
                    <button data-testid="encounter-add-condition" onClick={() => openEffectDialog('condition')}>🏷️ Add Condition</button>
                    <button data-testid="encounter-add-persistent-damage" onClick={() => openEffectDialog('persistent')}>🔥 Add Persistent Damage</button>
                    <button data-testid="encounter-add-affliction" onClick={() => openEffectDialog('affliction')}>☣️ Add Affliction</button>
                    <button data-testid="encounter-add-custom-condition" onClick={() => openEffectDialog('custom')}>✏️ Set Custom Condition</button>
                </div>
            )}
            <EncounterEffectDialogs
                mode={effectDialog?.mode || null}
                combatant={effectDialog?.combatant || null}
                onClose={() => setEffectDialog(null)}
                onAddCondition={addStandardConditionToCombatant}
                onAddPersistentDamage={addPersistentDamageToCombatant}
                onAddCustomBadge={addCustomBadgeToCombatant}
            />
        </div>
    );
}
