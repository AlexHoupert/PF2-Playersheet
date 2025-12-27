import React, { useState } from 'react';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';

export function ShieldModal({ character, updateCharacter }) {
    const [editVal, setEditVal] = useState("");

    const inventory = Array.isArray(character.inventory) ? character.inventory : [];
    // Find equipped shield
    const shields = inventory.filter(i => {
        const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
        const type = String(i?.type || fromIndex?.type || '').toLowerCase();
        return type === 'shield';
    });
    const equippedShield = shields.find(i => Boolean(i?.equipped));

    if (!equippedShield) {
        return <div>No shield equipped.</div>;
    }

    const shieldHp = character.stats.ac.shield_hp || 0;
    const fromIndex = equippedShield?.name ? getShopIndexItemByName(equippedShield.name) : null;
    const merged = fromIndex ? { ...fromIndex, ...equippedShield } : equippedShield;
    const shieldMax = (merged.hpMax) || (merged.system?.hp?.max) || 20;
    const hardness = (merged.hardness) || (merged.system?.hardness) || 0;

    return (
        <>
            <h2>Shield Status</h2>
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
