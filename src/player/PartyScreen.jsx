/**
 * PartyScreen – Read-only encounter display for players.
 * Opened via ?party=true. Shows initiative tracker with visible combatants only.
 * Creature stats respect revealState. Syncs live via Firestore.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../shared/context/CampaignContext';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';
import CreatureCard from '../shared/components/CreatureCard';
import InitiativeCard from '../admin/components/InitiativeCard';
import './PartyScreen.css';

export default function PartyScreen({ db }) {
    const { activeCampaign } = useCampaign();
    const [creatureDataCache, setCreatureDataCache] = useState({});

    const encounters = activeCampaign?.encounters || [];
    const characters = activeCampaign?.characters || [];
    const activeEncounter = encounters.find(e => e.isActive) || null;
    const allCreatures = useMemo(() => getAllCreatures(), []);

    // Only show visible combatants
    const visibleCombatants = useMemo(() => {
        if (!activeEncounter) return [];
        return [...activeEncounter.combatants]
            .filter(c => c.visible)
            .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
    }, [activeEncounter?.combatants]);

    const activeTurnId = useMemo(() => {
        if (!activeEncounter || visibleCombatants.length === 0) return null;
        // The active turn comes from the full sorted list (including hidden)
        const allSorted = [...(activeEncounter.combatants || [])]
            .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        return allSorted[activeEncounter.currentTurnIndex ?? 0]?.id;
    }, [activeEncounter]);

    // selectedEntityId from GM
    const selectedEntityId = activeEncounter?.selectedEntityId || null;
    const selectedCombatant = activeEncounter?.combatants?.find(c => c.id === selectedEntityId && c.visible);
    const infoCreatureData = selectedCombatant?.type === 'creature' ? creatureDataCache[selectedCombatant.creatureId] : null;
    const infoCharData = selectedCombatant?.type === 'player' ? characters.find(c => c.id === selectedCombatant.playerId) : null;

    // Load creature data
    useEffect(() => {
        if (!activeEncounter) return;
        activeEncounter.combatants
            .filter(c => c.type === 'creature' && c.visible && c.creatureId && !creatureDataCache[c.creatureId])
            .forEach(c => {
                const catalogEntry = allCreatures.find(cat => cat.id === c.creatureId || cat.name === c.creatureId);
                if (catalogEntry?.sourceFile) {
                    fetchCreatureData(catalogEntry.sourceFile).then(data => {
                        if (data) setCreatureDataCache(prev => ({ ...prev, [c.creatureId]: data }));
                    });
                }
            });
    }, [activeEncounter?.combatants]);

    const getRevealState = (creatureId) => {
        return db?.bestiary?.creatures?.[creatureId]?.revealState || {};
    };

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
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Info Panel – shown when GM selects a visible entity */}
            {selectedCombatant && (
                <div className="party-info">
                    <div className="party-info__header">
                        <h2>{selectedCombatant.name}</h2>
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
                            <div className="party-info__player-summary">
                                <h3>{infoCharData.name}</h3>
                                <p>Level {infoCharData.level} {infoCharData.class || ''}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
