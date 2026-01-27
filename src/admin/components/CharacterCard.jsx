import React, { useState } from 'react';
import { StatsView } from '../../player/views/StatsView';
import { InventoryView } from '../../player/views/InventoryView';
import { MagicView } from '../../player/views/MagicView';
import { FeatsView } from '../../player/views/FeatsView';
import { ImpulsesView } from '../../player/views/ImpulsesView';
import { getInventoryBucket, isEquipableInventoryItem } from '../../shared/utils/combatUtils'; // Verify imports

export function CharacterCard({
    character,
    db,
    setDb, // mostly for Loot view inside Inventory if enabled?
    updateCharacter,
    setModalMode,
    setModalData,
    onOpenModalLong, // wrapper to handle long press bubbling
    onOpenModal // wrapper to set activeCharIndex before opening modal
}) {
    const [activeTab, setActiveTab] = useState('stats');

    // --- Handlers for InventoryView ---
    // These logic bits are duplicated from PlayerApp.Ideally we extract them to a hook.
    // For now, I'll implement simplified versions or copy them.
    // Since Admin might want full fidelity, I should try to replicate the logic.

    const handleToggleEquip = (item) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (!item.instanceId && i.name === item.name && !!i.equipped === !!item.equipped)
            );
            if (idx > -1) {
                // If equipping armor, unequip other armor
                const isArmor = item.type?.toLowerCase() === 'armor' || (item.category === 'Armor');
                if (isArmor && !c.inventory[idx].equipped) {
                    c.inventory.forEach(i => {
                        if ((i.type?.toLowerCase() === 'armor' || i.category === 'Armor') && i.equipped) {
                            i.equipped = false;
                        }
                    });
                }
                c.inventory[idx].equipped = !c.inventory[idx].equipped;
            }
        });
    };

    const handleConsume = (item) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i => i.name === item.name && i.qty > 0);
            if (idx > -1) {
                c.inventory[idx].qty--;
                if (c.inventory[idx].qty <= 0) c.inventory.splice(idx, 1);

                // Add effect logic if needed (mutagens etc)? 
                // For now, just decrement. Admin can manually condition.
            }
        });
    };

    // Generic helper for unified API - uses onOpenModal prop if available, otherwise direct setters
    const handleOpenModal = (mode, data) => {
        if (onOpenModal) {
            // Use the passed handler which sets activeCharIndex
            onOpenModal(mode, data);
        } else {
            // Fallback to direct setting (may not set activeCharIndex)
            if (data !== undefined) setModalData(data);
            setModalMode(mode);
        }
    };

    // Derived logic for display
    const isCaster = character.isCaster || (character.magic?.list?.length > 0);
    const isKineticist = character.isKineticist || (character.impulses?.length > 0);


    return (
        <div className="char-card">
            <div className="char-header">
                <div>{character.name}</div>
                <div style={{ fontSize: '0.8em', color: '#888' }}>Level {character.level}</div>
            </div>

            <div className="card-tabs">
                <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>Stats</button>
                <button className={activeTab === 'inv' ? 'active' : ''} onClick={() => setActiveTab('inv')}>Inv</button>
                {(isCaster || activeTab === 'spells') && <button className={activeTab === 'spells' ? 'active' : ''} onClick={() => setActiveTab('spells')}>Spells</button>}
                {(isKineticist || activeTab === 'impulses') && <button className={activeTab === 'impulses' ? 'active' : ''} onClick={() => setActiveTab('impulses')}>Impulses</button>}
                <button className={activeTab === 'feats' ? 'active' : ''} onClick={() => setActiveTab('feats')}>Feats</button>
            </div>

            <div className="char-card-body">
                {activeTab === 'stats' && (
                    <StatsView
                        character={character}
                        updateCharacter={updateCharacter}
                        onOpenModal={handleOpenModal}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'inv' && (
                    <InventoryView
                        character={character}
                        db={db}
                        onUpdateCharacter={updateCharacter}
                        onSetDb={setDb}
                        onOpenModal={handleOpenModal}
                        onToggleEquip={handleToggleEquip}
                        onInspectItem={(item) => handleOpenModal('item', item)}
                        onConsumeItem={handleConsume}
                        // Dummy handlers for combat actions to prevent crash if clicked
                        onFireWeapon={() => { }}
                        onLoadWeapon={() => { }}
                        onLongPress={onOpenModalLong}
                        // Admin doesn't need to open shop from here typically, or maybe?
                        onOpenShop={() => { }}
                    />
                )}
                {activeTab === 'spells' && (
                    <MagicView
                        character={character}
                        updateCharacter={updateCharacter}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={(mode) => console.log("Catalog not impl in card yet", mode)} // TODO
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'impulses' && (
                    <ImpulsesView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'feats' && (
                    <FeatsView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={() => { }}
                        onLongPress={onOpenModalLong}
                    />
                )}
            </div>
        </div>
    );
}
