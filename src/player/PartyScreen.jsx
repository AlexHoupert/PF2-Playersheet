/**
 * PartyScreen – Read-only encounter display for players.
 * Opened via ?party=true. Shows initiative tracker with visible combatants only.
 * Creature stats respect revealState. Syncs live via Firestore.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../shared/context/CampaignContext';
import CreatureCard from '../shared/components/CreatureCard';
import { ActorSheetCard } from '../shared/components/ActorSheetCard';
import InitiativeCard from '../admin/components/InitiativeCard';
import {
    selectBestiaryCreatureMetadataEntry,
    selectBestiaryRevealState,
    selectCustomCreatureData,
} from '../shared/db/selectors/bestiarySelectors';
import { selectActiveCharacters } from '../shared/db/selectors/characterSelectors';
import {
    selectCombatantEffectPresentationItems,
    selectCombatantEffects,
} from '../shared/db/selectors/effectSelectors';
import { selectVisibleCreatureFields } from '../shared/bestiary/creaturePresentation';
import { getCurrentTurnCombatantId, getRotatedEncounterTurnOrder } from '../shared/encounter/turnOrder';
import './PartyScreen.css';

export default function PartyScreen() {
    const { activeCampaign, db } = useCampaign();
    const [creatureDataCache, setCreatureDataCache] = useState({});

    const encounters = activeCampaign?.encounters || [];
    const characters = useMemo(() => selectActiveCharacters(activeCampaign), [activeCampaign]);
    const activeEncounter = encounters.find(e => e.isActive) || null;

    // Only show visible combatants, rotated so active is on top
    const visibleCombatants = useMemo(() => {
        if (!activeEncounter) return [];
        const rotated = getRotatedEncounterTurnOrder(activeEncounter, { includeDefeated: false });
        return rotated.filter(c => c.visible);
    }, [activeEncounter]);

    // Active combatant is always first in the full rotated list (may be hidden)
    const activeTurnId = useMemo(() => {
        if (!activeEncounter) return null;
        return getCurrentTurnCombatantId(activeEncounter);
    }, [activeEncounter]);

    // selectedEntityId from GM
    const selectedEntityId = activeEncounter?.selectedEntityId || null;
    const selectedCombatant = visibleCombatants.find(c => c.id === selectedEntityId) || null;
    const infoCreatureData = selectedCombatant?.type === 'creature' ? creatureDataCache[selectedCombatant.creatureId] : null;
    const infoCharData = selectedCombatant?.type === 'player' ? characters.find(c => c.id === selectedCombatant.playerId) : null;

    // Load creature data
    useEffect(() => {
        if (!activeEncounter) return;
        const missingCreatures = activeEncounter.combatants
            .filter(c => c.type === 'creature' && c.visible && c.creatureId && !creatureDataCache[c.creatureId]);
        if (missingCreatures.length === 0) return;

        let cancelled = false;
        const customResolved = [];
        const catalogNeeded = [];

        missingCreatures.forEach(c => {
            // Custom creatures are already part of the projected DB.
            const customData = selectCustomCreatureData(db, c.creatureId);
            if (customData) customResolved.push([c.creatureId, customData]);
            else catalogNeeded.push(c);
        });

        if (customResolved.length) {
            setCreatureDataCache(prev => {
                const next = { ...prev };
                customResolved.forEach(([id, data]) => {
                    next[id] = data;
                });
                return next;
            });
        }

        if (catalogNeeded.length) {
            import('../shared/catalog/creatureIndex').then(module => {
                catalogNeeded.forEach(c => {
                    const catalogEntry = module.getCreatureFromIndex(c.creatureId)
                        || module.getAllCreatures().find(cat => cat.name === c.creatureId);
                    if (catalogEntry?.id) {
                        module.fetchCreatureData(catalogEntry.id).then(data => {
                            if (!cancelled && data) {
                                setCreatureDataCache(prev => ({ ...prev, [c.creatureId]: data }));
                            }
                        });
                    }
                });
            });
        }

        return () => {
            cancelled = true;
        };
    }, [activeEncounter?.combatants]);

    const getRevealState = (creatureId) => {
        return selectBestiaryRevealState(db, creatureId);
    };

    const getCreatureFalseData = (creatureId) => selectBestiaryCreatureMetadataEntry(db, creatureId)?.falseData || {};

    if (!activeEncounter) {
        return (
            <div className="party-screen party-screen--empty">
                <div className="party-screen__waiting">
                    <span className="party-screen__waiting-icon">⚔️</span>
                    <h1>Waiting for encounter...</h1>
                    <p>The GM hasn't started an encounter yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="party-screen">
            {/* Initiative Tracker */}
            <div className="party-tracker">
                <div className="party-tracker__header">
                    <h1 className="party-tracker__title">{activeEncounter.name}</h1>
                </div>
                <div className="party-tracker__list">
                    <AnimatePresence mode="popLayout">
                        {visibleCombatants.map(combatant => (
                            <InitiativeCard
                                key={combatant.id}
                                combatant={combatant}
                                isActive={combatant.id === activeTurnId}
                                isSelected={combatant.id === selectedEntityId}
                                isGM={false}
                                creatureData={combatant.type === 'creature' ? creatureDataCache[combatant.creatureId] : null}
                                characterData={combatant.type === 'player' ? characters.find(c => c.id === combatant.playerId) : null}
                                revealState={combatant.type === 'creature' ? getRevealState(combatant.creatureId) : {}}
                                falseData={combatant.type === 'creature' ? getCreatureFalseData(combatant.creatureId) : {}}
                                combatantEffects={selectCombatantEffects(activeCampaign, activeEncounter.id, combatant)}
                                effectBadges={selectCombatantEffectPresentationItems(activeCampaign, activeEncounter.id, combatant, { viewerMode: 'party' })}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Info Panel – shown when GM selects a visible entity */}
            {selectedCombatant && (
                <div className="party-info">
                    <div className="party-info__header">
                        <h2>
                            {selectedCombatant.type === 'creature'
                                ? selectVisibleCreatureFields({
                                    name: selectedCombatant.name,
                                    unknownName: selectedCombatant.unknownName,
                                    level: selectedCombatant.level,
                                    revealState: getRevealState(selectedCombatant.creatureId),
                                }, 'player').name
                                : selectedCombatant.name}
                        </h2>
                    </div>
                    <div className="party-info__body">
                        {selectedCombatant.type === 'creature' && infoCreatureData && (
                            <CreatureCard
                                creature={infoCreatureData}
                                isGM={false}
                                revealState={getRevealState(selectedCombatant.creatureId)}
                            />
                        )}
                        {selectedCombatant.type === 'creature' && !infoCreatureData && (
                            <div className="party-info__loading">Loading...</div>
                        )}
                        {selectedCombatant.type === 'player' && infoCharData && (
                            <ActorSheetCard
                                character={infoCharData}
                                db={db}
                                updateCharacter={() => {}}
                                mode="party"
                                capabilities={{
                                    editable: false,
                                    showInventory: true,
                                    showMagic: true,
                                    showPacts: false,
                                    allowShop: false,
                                    allowLoot: false,
                                    localModals: true,
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

