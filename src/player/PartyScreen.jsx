/**
 * PartyScreen – Read-only encounter display for players.
 * Opened via ?party=true. Shows initiative tracker with visible combatants only.
 * Creature stats respect revealState. Syncs live via Firestore.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useCampaign } from '../shared/context/CampaignContext';
import CreatureCard from '../shared/components/CreatureCard';
import { CharacterCard } from '../admin/components/CharacterCard';
import InitiativeCard from '../admin/components/InitiativeCard';
import { selectBestiaryRevealState, selectCustomCreatureData } from '../shared/db/selectors/bestiarySelectors';
import './PartyScreen.css';

export default function PartyScreen({ db }) {
    const { activeCampaign } = useCampaign();
    const [creatureDataCache, setCreatureDataCache] = useState({});

    const encounters = activeCampaign?.encounters || [];
    const characters = activeCampaign?.characters || [];
    const activeEncounter = encounters.find(e => e.isActive) || null;

    // Only show visible combatants, rotated so active is on top
    const visibleCombatants = useMemo(() => {
        if (!activeEncounter) return [];
        const byInit = [...activeEncounter.combatants]
            .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        const idx = (activeEncounter.currentTurnIndex ?? 0) % (byInit.length || 1);
        const rotated = [...byInit.slice(idx), ...byInit.slice(0, idx)];
        return rotated.filter(c => c.visible);
    }, [activeEncounter?.combatants, activeEncounter?.currentTurnIndex]);

    // Active combatant is always first in the full rotated list (may be hidden)
    const activeTurnId = useMemo(() => {
        if (!activeEncounter) return null;
        const byInit = [...(activeEncounter.combatants || [])]
            .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        const idx = (activeEncounter.currentTurnIndex ?? 0) % (byInit.length || 1);
        return byInit[idx]?.id;
    }, [activeEncounter]);

    // selectedEntityId from GM
    const selectedEntityId = activeEncounter?.selectedEntityId || null;
    const selectedCombatant = activeEncounter?.combatants?.find(c => c.id === selectedEntityId && c.visible);
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
                            {selectedCombatant.type === 'creature' && getRevealState(selectedCombatant.creatureId)?.name !== 'precise'
                                ? (selectedCombatant.unknownName || '???')
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
                            <CharacterCard
                                character={infoCharData}
                                db={db}
                                setDb={() => { }}
                                updateCharacter={() => { }}
                                setModalMode={() => { }}
                                setModalData={() => { }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

