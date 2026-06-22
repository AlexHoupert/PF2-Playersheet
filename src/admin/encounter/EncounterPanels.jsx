import React, { useState } from 'react';
import CreatureCard from '../../shared/components/CreatureCard';
import CreatureAbilityModal from '../../shared/components/CreatureAbilityModal';
import CreatureSkillDetailDialog from '../../shared/components/CreatureSkillDetailDialog';
import { ActorSheetCard } from '../../shared/components/ActorSheetCard';

export function EncounterInfoPanel({
    db,
    infoCharData,
    infoCreatureData,
    onRevealChange,
    onUpdateCharacter,
    selectedCombatant,
    getRevealState,
}) {
    const [selectedAbility, setSelectedAbility] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);

    if (!selectedCombatant) return null;
    return (
        <div className="enc-info-panel__body">
            {selectedCombatant.type === 'creature' && infoCreatureData && (
                <CreatureCard
                    creature={infoCreatureData}
                    isGM={true}
                    revealState={getRevealState(selectedCombatant.creatureId)}
                    onRevealChange={onRevealChange}
                    onAbilityClick={(ability) => setSelectedAbility(ability)}
                    onSkillClick={(skill) => setSelectedSkill(skill)}
                />
            )}
            {selectedCombatant.type === 'creature' && !infoCreatureData && (
                <div className="enc-info-panel__loading">Loading creature data...</div>
            )}
            {selectedCombatant.type === 'player' && infoCharData && (
                <ActorSheetCard
                    character={infoCharData}
                    db={db}
                    updateCharacter={onUpdateCharacter}
                    mode="encounter"
                    capabilities={{
                        editable: true,
                        showInventory: true,
                        showMagic: true,
                        showPacts: true,
                        allowShop: false,
                        allowLoot: false,
                        localModals: true,
                    }}
                />
            )}
            {selectedCombatant.type === 'player' && !infoCharData && (
                <div className="enc-info-panel__loading">Player data not found.</div>
            )}
            {selectedAbility && (
                <CreatureAbilityModal
                    ability={selectedAbility}
                    onClose={() => setSelectedAbility(null)}
                />
            )}
            {selectedSkill && (
                <CreatureSkillDetailDialog
                    skill={selectedSkill}
                    onClose={() => setSelectedSkill(null)}
                />
            )}
        </div>
    );
}

export function EncounterSidebar({
    activeCampaign,
    activeLoot,
    activeTrader,
    activateEncounter,
    addAllPlayers,
    addCreatureToEncounter,
    archivedEncounters,
    createEncounter,
    creatureSearch,
    deleteEncounter,
    encounters,
    filteredCreatures,
    removeCombatant,
    restoreEncounter,
    selectedEncounter,
    selectedEncounterId,
    setCreatureSearch,
    setSelectedEncounterId,
}) {
    void activeCampaign;
    void activeLoot;
    void activeTrader;
    return (
        <>
            <div className="enc-sidebar__header">
                <h3>Encounters</h3>
                <button className="enc-btn enc-btn--small" onClick={createEncounter} title="New Encounter">+</button>
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
                            {enc.isActive && <span className="enc-sidebar__active-dot">*</span>}
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
                                    Activate
                                </button>
                            )}
                            <button className="enc-btn enc-btn--small" onClick={() => addAllPlayers(selectedEncounter.id)} title="Add all players">
                                Players+
                            </button>
                        </div>
                    </div>
                    <div className="enc-sidebar__combatants">
                        {selectedEncounter.combatants.map(c => (
                            <div key={c.id} className="enc-sidebar__combatant">
                                <span>{c.type === 'player' ? 'PC' : 'NPC'} {c.name}{c.instanceLabel > 1 ? ` #${c.instanceLabel}` : ''}</span>
                                <button className="enc-btn enc-btn--tiny enc-btn--danger" onClick={() => removeCombatant(selectedEncounter.id, c.id)}>x</button>
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
                                            {c.isCustom && <span style={{ marginLeft: 5, fontSize: '0.72em', color: '#c5a059' }}>*</span>}
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
}
