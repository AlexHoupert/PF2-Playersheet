import React, { useState } from 'react';
import { getArmorClassData } from '../../shared/hooks/useCharacterStats';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';

const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];

/**
 * Modal to view Armor Class breakdown and toggle equipped armor/shields.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function ACModal({ character, updateCharacter, onClose }) {
    const acData = getArmorClassData(character);
    const inventory = Array.isArray(character?.inventory) ? character.inventory : [];

    const armorItems = inventory.filter(invItem => {
        const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
        const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
        const cat = String(invItem?.category || fromIndex?.category || '').toLowerCase();
        return type === 'armor' || cat.includes('armor');
    });

    const equippedArmor = armorItems.find(i => Boolean(i?.equipped));

    const toggleArmorEquipped = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        updateCharacter(c => {
            if (!Array.isArray(c.inventory)) c.inventory = [];
            if (!c.stats) c.stats = {};
            if (!c.stats.ac) c.stats.ac = {};

            const isArmor = (invItem) => {
                const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
                const cat = String(invItem?.category || fromIndex?.category || '').toLowerCase();
                return type === 'armor' || cat.includes('armor');
            };

            const armorIndices = [];
            c.inventory.forEach((item, idx) => {
                if (isArmor(item)) armorIndices.push(idx);
            });

            // Check if any armor is currently equipped
            const currentlyEquippedIndex = armorIndices.find(idx => !!c.inventory[idx].equipped);

            if (currentlyEquippedIndex !== undefined) {
                // Unequip it
                c.stats.ac.last_armor = c.inventory[currentlyEquippedIndex].name;
                c.inventory[currentlyEquippedIndex].equipped = false;
                c.stats.ac.armor_equipped = false;
                return;
            }

            // Nothing equipped, so equip something
            let targetIndex = -1;
            const last = c.stats.ac.last_armor;

            if (last) {
                targetIndex = armorIndices.find(idx => c.inventory[idx].name === last);
            }

            // If not found, use first available armor
            if ((targetIndex === undefined || targetIndex === -1) && armorIndices.length > 0) {
                targetIndex = armorIndices[0];
            }

            if (targetIndex !== undefined && targetIndex !== -1) {
                // Unequip others first to be safe
                armorIndices.forEach(idx => c.inventory[idx].equipped = false);

                c.inventory[targetIndex].equipped = true;
                c.stats.ac.last_armor = c.inventory[targetIndex].name;
                c.stats.ac.armor_equipped = true;
            } else {
                c.stats.ac.armor_equipped = false;
            }
        });
    };

    const toggleShieldEquipped = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        updateCharacter(c => {
            if (!Array.isArray(c.inventory)) c.inventory = [];

            const isShield = (invItem) => {
                const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
                return type === 'shield';
            };

            const shieldIndices = [];
            c.inventory.forEach((item, idx) => {
                if (isShield(item)) shieldIndices.push(idx);
            });

            // Check if any shield is currently equipped
            const currentlyEquippedIndex = shieldIndices.find(idx => !!c.inventory[idx].equipped);

            if (currentlyEquippedIndex !== undefined) {
                c.inventory[currentlyEquippedIndex].equipped = false;
                return;
            }

            // Nothing equipped, equip first available
            if (shieldIndices.length > 0) {
                const targetIndex = shieldIndices[0];
                c.inventory[targetIndex].equipped = true;
            }
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                borderRadius: '8px', maxWidth: '400px', width: '100%',
                color: '#e0e0e0',
                padding: 20,
                display: 'flex', flexDirection: 'column',
                maxHeight: '90vh', overflowY: 'auto'
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{
                    fontSize: '1.4em', marginBottom: 20, textAlign: 'center',
                    color: 'var(--text-gold)', fontFamily: 'Cinzel, serif',
                    borderBottom: '1px solid #5c4033', paddingBottom: 10
                }}>
                    Armor Class
                </h2>

                <div style={{
                    marginTop: 15,
                    paddingTop: 12,
                    fontSize: '0.85em',
                    color: '#aaa',
                    lineHeight: 1.5,
                    background: '#222', padding: 10, borderRadius: 5
                }}>
                    <div style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.75em', color: '#888', marginBottom: 6 }}>
                        AC Breakdown
                    </div>
                    <div>
                        <strong>Total:</strong> <span style={{ color: '#fff' }}>{acData.totalAC}</span>
                        {acData.acPenalty < 0 ? <span style={{ color: 'var(--accent-red)' }}> ({acData.acPenalty})</span> : null}
                        <span style={{ color: '#888' }}> — Base {acData.baseAC}</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                        <strong>Armor:</strong> {acData.armorName ? `${acData.armorName} (${acData.armorCategory || 'untyped'})` : 'None (Unarmored)'}
                        {acData.armorItemBonus ? <span style={{ color: '#888' }}> — Item +{acData.armorItemBonus} AC</span> : null}
                    </div>
                    {acData.shieldName && (
                        <div style={{ marginTop: 6 }}>
                            <strong>Shield:</strong> {acData.shieldName} {acData.shieldRaised ? '(Raised)' : '(Lowered)'}
                            <span style={{ color: '#888' }}> — Item +{acData.shieldItemBonus} AC {acData.shieldRaised ? '' : '(Inactive)'}</span>
                        </div>
                    )}
                    <div style={{ marginTop: 6 }}>
                        <strong>Dex:</strong> {acData.dexMod >= 0 ? `+${acData.dexMod}` : acData.dexMod}
                        {typeof acData.dexCap === 'number'
                            ? <span style={{ color: '#888' }}> (cap {acData.dexCap}, used {acData.dexUsed >= 0 ? `+${acData.dexUsed}` : acData.dexUsed})</span>
                            : <span style={{ color: '#888' }}> (used {acData.dexUsed >= 0 ? `+${acData.dexUsed}` : acData.dexUsed})</span>}
                    </div>
                    <div style={{ marginTop: 6 }}>
                        <strong>Proficiency:</strong> {acData.profKey} {acData.profRank}
                        {acData.profRank > 0
                            ? <span style={{ color: '#888' }}> + lvl {acData.level} = {acData.profBonus}</span>
                            : <span style={{ color: '#888' }}> (untrained, no level)</span>}
                    </div>
                    <div style={{ marginTop: 6, fontStyle: 'italic', color: '#666' }}>
                        10 + {acData.dexUsed} (Dex) + {acData.profBonus} (Prof) + {acData.armorItemBonus} (Item) {acData.activeShieldBonus ? `+ ${acData.activeShieldBonus} (Shield)` : ''}
                    </div>
                </div>

                <div style={{ marginTop: 20 }}>
                    <div className="modal-toggle-row" onClick={toggleArmorEquipped} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #444', cursor: 'pointer' }}>
                        <span>Armor Equipped</span>
                        <div style={{ position: 'relative', width: 40, height: 20, background: Boolean(equippedArmor) ? 'var(--text-gold)' : '#555', borderRadius: 20, transition: '0.3s' }}>
                            <div style={{ position: 'absolute', top: 2, left: Boolean(equippedArmor) ? 22 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: '0.3s' }}></div>
                        </div>
                    </div>
                    {armorItems.length > 0 && (
                        <div style={{ marginBottom: 10, color: '#888', fontSize: '0.85em', textAlign: 'right' }}>
                            {equippedArmor ? `Equipped: ${equippedArmor.name}` : 'No armor equipped.'}
                        </div>
                    )}
                    {armorItems.length === 0 && (
                        <div style={{ marginBottom: 10, color: '#666', fontStyle: 'italic', fontSize: '0.85em', textAlign: 'right' }}>
                            No armor found.
                        </div>
                    )}

                    <div className="modal-toggle-row" onClick={toggleShieldEquipped} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', cursor: 'pointer' }}>
                        <span>Shield Equipped</span>
                        <div style={{
                            position: 'relative', width: 40, height: 20, background: Boolean(inventory.some(i => {
                                const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
                                const type = String(i?.type || fromIndex?.type || '').toLowerCase();
                                return type === 'shield' && i.equipped;
                            })) ? 'var(--text-gold)' : '#555', borderRadius: 20, transition: '0.3s'
                        }}>
                            <div style={{
                                position: 'absolute', top: 2, left: Boolean(inventory.some(i => {
                                    const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
                                    const type = String(i?.type || fromIndex?.type || '').toLowerCase();
                                    return type === 'shield' && i.equipped;
                                })) ? 22 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: '0.3s'
                            }}></div>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 20 }}>
                    <button onClick={onClose} style={{
                        width: '100%', padding: '10px', background: '#c5a059',
                        border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                        fontSize: '0.9em'
                    }}>Close</button>
                </div>
            </div>
        </div>
    );
}

/**
 * Modal to manage Shield HP, Hardness, and Status.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function ShieldModal({ character, updateCharacter, onClose }) {
    const [editVal, setEditVal] = useState("");

    const inventory = Array.isArray(character.inventory) ? character.inventory : [];
    const shields = inventory.filter(i => {
        const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
        const type = String(i?.type || fromIndex?.type || '').toLowerCase();
        return type === 'shield';
    });
    const equippedShield = shields.find(i => Boolean(i?.equipped));

    let content = null;

    if (!equippedShield) {
        content = <div>No shield equipped.</div>;
    } else {
        const shieldHp = character.stats.ac.shield_hp || 0;
        const fromIndex = equippedShield?.name ? getShopIndexItemByName(equippedShield.name) : null;
        const merged = fromIndex ? { ...fromIndex, ...equippedShield } : equippedShield;
        const shieldMax = (merged.hpMax) || (merged.system?.hp?.max) || 20;
        const hardness = (merged.hardness) || (merged.system?.hardness) || 0;

        content = (
            <>
                <div style={{ marginBottom: 20, textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'var(--text-gold)' }}>{equippedShield.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
                        <div style={{ background: '#333', padding: '5px 10px', borderRadius: 5 }}>
                            <div style={{ fontSize: '0.8em', color: '#aaa' }}>Hardness</div>
                            <div style={{ fontSize: '1.2em' }}>{hardness}</div>
                        </div>
                        <div style={{ background: '#333', padding: '5px 10px', borderRadius: 5 }}>
                            <div style={{ fontSize: '0.8em', color: '#aaa' }}>Max HP</div>
                            <div style={{ fontSize: '1.2em' }}>{shieldMax}</div>
                        </div>
                    </div>
                </div>

                <div className="modal-form-group" style={{ textAlign: 'center' }}>
                    <label>Current Shield HP: <span style={{ color: shieldHp < shieldMax / 2 ? '#ff5252' : '#fff' }}>{shieldHp}</span></label>

                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => {
                            const oldHp = parseInt(c.stats.ac.shield_hp || 0);
                            const max = parseInt(shieldMax || 20);
                            const newHp = Math.max(0, oldHp - (parseInt(editVal) || 0));
                            c.stats.ac.shield_hp = newHp;
                            if (newHp < max / 2) {
                                c.stats.ac.shield_raised = false; // Auto-lower if broken
                            }
                        })}>-</button>
                        <input type="number" className="modal-input" style={{ width: 80, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="Amount" />
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.ac.shield_hp = Math.min(shieldMax, (c.stats.ac.shield_hp || 0) + (parseInt(editVal) || 0)))}>+</button>
                    </div>

                    <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center' }}>
                        <button
                            className="set-btn"
                            style={{ width: 'auto', padding: '5px 15px', fontSize: '0.9em' }}
                            onClick={() => {
                                updateCharacter(c => c.stats.ac.shield_hp = shieldMax);
                                setEditVal("");
                            }}
                        >Full Repair</button>
                        <button
                            className="set-btn"
                            style={{ width: 'auto', padding: '5px 15px', fontSize: '0.9em', marginLeft: 10, background: '#444' }}
                            onClick={() => {
                                updateCharacter(c => {
                                    const max = parseInt(shieldMax || 20);
                                    const newHp = parseInt(editVal) || 0;
                                    c.stats.ac.shield_hp = newHp;
                                    if (newHp < max / 2) {
                                        c.stats.ac.shield_raised = false;
                                    }
                                });
                                setEditVal("");
                            }}
                        >Set to Value</button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                borderRadius: '8px', maxWidth: '400px', width: '100%',
                color: '#e0e0e0',
                padding: 20
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ textAlign: 'center', color: 'var(--text-gold)', marginBottom: 20 }}>Shield Status</h2>
                {content}
                <button onClick={onClose} style={{
                    marginTop: 20, width: '100%', padding: '10px', background: '#c5a059',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                    fontSize: '0.9em'
                }}>Close</button>
            </div>
        </div>
    );
}
