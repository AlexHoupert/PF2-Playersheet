import React, { useState, useEffect, useMemo } from 'react';
import { shouldStack } from '../shared/utils/inventoryUtils';

// MODES: 'BUY', 'QTY', 'TRANSFER', 'CONTEXT'

export default function ItemActionsModal({ mode, item, characters, activeCharIndex, onClose, onBuy, onChangeQty, onTransfer, onUnstack, onLoadSpecial, onUnloadAll, onOpenMode, onEditProficiency }) {
    const [val, setVal] = useState(1);
    const [targetCharId, setTargetCharId] = useState('');

    const character = characters[activeCharIndex];
    if (!character) return null; // Guard
    const inventory = character.inventory || [];

    useEffect(() => {
        if (mode === 'CHANGE_QTY') {
            setVal(item.qty || 0); // Start with current count
        } else {
            setVal(1); // Default for Buy/Transfer
        }
    }, [mode, item]);

    const otherCharacters = useMemo(() => {
        return characters.map((c, i) => ({ name: c.name, index: i })).filter((c, i) => i !== activeCharIndex);
    }, [characters, activeCharIndex]);

    if (!mode) return null;

    // --- CONTEXT MENU ---
    if (mode === 'CONTEXT') {
        const isWeapon = (item.type || '').toLowerCase() === 'weapon';
        return (
            <div className="modal-overlay" onClick={onClose} style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.8)', zIndex: 11000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{
                    background: '#1a1a1a', border: '1px solid #c5a059',
                    borderRadius: 8, padding: 20, minWidth: 250, textAlign: 'center'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#c5a059' }}>{item.name}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button className="btn-add-condition" onClick={() => onOpenMode('CHANGE_QTY', item)}>Change Amount</button>
                        <button className="btn-add-condition" onClick={() => onOpenMode('BUY_RESTOCK', item)}>Restock</button>
                        <button className="btn-add-condition" onClick={() => onOpenMode('TRANSFER', item)}>Give to Player</button>
                        {isWeapon && onEditProficiency && (
                            <button className="btn-add-condition" onClick={() => onEditProficiency(item)}>Proficiency</button>
                        )}
                        {onUnstack && (item.qty || 1) > 1 && !shouldStack(item) && (
                            <button className="btn-add-condition" style={{ borderColor: '#d32f2f', color: '#ff8a80' }} onClick={() => onUnstack(item)}>Unstack Split</button>
                        )}
                        {/* Load Special Ammo Option */}
                        {onLoadSpecial && (
                            ['crossbow', 'firearm', 'firearms', 'crossbows'].includes((item.group || '').toLowerCase()) ||
                            (item.traits?.value || []).includes('repeating') ||
                            /pistol|rifle|gun|arquebus|blunderbuss|musket|pepperbox|cannon|revolver|crossbow/i.test(item.name)
                        ) && (
                                <>
                                    <button className="btn-add-condition" style={{ borderColor: '#42a5f5', color: '#90caf9' }} onClick={() => onOpenMode('LOAD_AMMO', item)}>Load Special Ammo</button>
                                    {item.loaded && item.loaded.some(l => l) && (
                                        <button className="btn-add-condition" style={{ borderColor: '#ffb74d', color: '#ffcc80' }} onClick={() => onUnloadAll(item)}>Unload Weapon</button>
                                    )}
                                </>
                            )}
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'LOAD_AMMO') {
        // Filter inventory for ammo
        const ammoList = inventory.filter(i => {
            const type = (i.type || '').toLowerCase();
            const category = (i.category || '').toLowerCase();
            const traits = (i.traits?.value || []);
            const name = i.name.toLowerCase();

            // Exclude Basic Ammo
            if (name.includes('arrow') || name.includes('bolt') || name.startsWith('rounds (')) return false;

            // Include Valid Ammo Types
            // Bomb is technically a weapon but treated as special ammo often? 
            // User said: "available are bombs but not the special ammo types" -> implied bombs ARE showing but shouldn't?
            // "just show every item that is Type: Ammo and not named..."
            // So if type is ammo, show it (unless excluded above).
            return category === 'ammo' || type === 'ammunition' || type === 'ammo' || traits.includes('ammunition');
        });

        return (
            <div className="modal-overlay" onClick={onClose} style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', zIndex: 11002,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{
                    background: '#2b2b2e', border: '1px solid #c5a059',
                    borderRadius: 8, padding: 20, width: '90%', maxWidth: 400,
                    maxHeight: '80vh', overflowY: 'auto'
                }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#c5a059', textAlign: 'center' }}>Load Into {item.name}</h3>
                    {ammoList.length === 0 ? (
                        <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center' }}>No special ammunition found.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {ammoList.map((ammo, idx) => (
                                <div key={idx} onClick={() => onLoadSpecial(item, ammo)} style={{
                                    padding: '10px', background: '#1a1a1d', border: '1px solid #444',
                                    borderRadius: 4, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <span style={{ fontWeight: 'bold', color: '#ccc' }}>{ammo.name}</span>
                                    <span style={{ color: '#888' }}>x{ammo.qty || 1}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button onClick={onClose} style={{
                        width: '100%', marginTop: 15, padding: 10, background: '#333', color: '#ccc', border: 'none', cursor: 'pointer'
                    }}>Cancel</button>
                </div>
            </div>
        );
    }

    // --- GENERIC FORM MODAL ---
    const title = mode === 'BUY_RESTOCK' ? `Buy ${item.name}`
        : mode === 'TRANSFER' ? `Give ${item.name}`
            : `Manage ${item.name}`;

    const confirmLabel = mode === 'BUY_RESTOCK' ? 'Purchase'
        : mode === 'TRANSFER' ? 'Transfer'
            : 'Update';

    const handleConfirm = () => {
        if (mode === 'BUY_RESTOCK') onBuy(item, val);
        else if (mode === 'CHANGE_QTY') onChangeQty(item, val);
        else if (mode === 'TRANSFER') onTransfer(item, targetCharId, val);
    };

    const price = item.price || 0;
    const totalCost = (price * val).toFixed(2);

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 11001,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{
                background: '#2b2b2e', border: '2px solid #c5a059',
                borderRadius: 8, padding: 20, width: '90%', maxWidth: 400,
                boxShadow: '0 0 20px #000'
            }}>
                <h2 style={{ fontFamily: 'Cinzel, serif', color: '#c5a059', marginTop: 0, textAlign: 'center' }}>{title}</h2>

                {/* Body */}
                <div style={{ margin: '20px 0', textAlign: 'center' }}>

                    {/* Qty Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 15 }}>
                        <button className="qty-btn" onClick={() => setVal(Math.max(0, val - 1))} style={{
                            background: '#1a1a1d', color: '#c5a059', border: '1px solid #c5a059',
                            fontSize: 24, width: 44, height: 44, borderRadius: 6, cursor: 'pointer'
                        }}>-</button>

                        <input
                            type="number"
                            value={val}
                            onChange={e => setVal(parseInt(e.target.value) || 0)}
                            style={{
                                background: '#1a1a1d', color: 'white', border: '1px solid #666',
                                fontSize: '1.5em', padding: 5, width: 80, textAlign: 'center', borderRadius: 5
                            }}
                        />

                        <button className="qty-btn" onClick={() => setVal(val + 1)} style={{
                            background: '#1a1a1d', color: '#c5a059', border: '1px solid #c5a059',
                            fontSize: 24, width: 44, height: 44, borderRadius: 6, cursor: 'pointer'
                        }}>+</button>
                    </div>

                    {/* Presets (Only for Buy/Restock/Transfer where you add val, not set absolute) */}
                    {(mode === 'BUY_RESTOCK' || mode === 'TRANSFER') && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 15 }}>
                            {[1, 5, 10].map(n => (
                                <button key={n} onClick={() => setVal(n)} style={{
                                    background: '#444', border: '1px solid #666', color: '#ccc',
                                    padding: '5px 10px', borderRadius: 4, cursor: 'pointer'
                                }}>+{n}</button>
                            ))}
                        </div>
                    )}

                    {/* Metadata Display */}
                    {mode === 'BUY_RESTOCK' && (
                        <div style={{ color: '#aaa' }}>
                            Total Price: <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{totalCost} gp</span>
                        </div>
                    )}

                    {mode === 'TRANSFER' && (
                        <div style={{ marginTop: 15 }}>
                            <div style={{ marginBottom: 5, color: '#aaa' }}>Recipient:</div>
                            <select
                                value={targetCharId}
                                onChange={e => setTargetCharId(e.target.value)}
                                style={{
                                    width: '100%', padding: 8, background: '#1a1a1d',
                                    color: 'white', border: '1px solid #c5a059', borderRadius: 4
                                }}
                            >
                                <option value="">-- Select Player --</option>
                                {otherCharacters.map(c => (
                                    <option key={c.index} value={c.index}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{
                        flex: 1, background: '#333', color: '#ccc', border: '1px solid #555',
                        padding: 10, cursor: 'pointer', fontFamily: 'Cinzel, serif'
                    }}>Cancel</button>
                    <button onClick={handleConfirm} disabled={mode === 'TRANSFER' && !targetCharId} style={{
                        flex: 1, background: '#c5a059', color: '#1a1a1d', border: 'none',
                        padding: 10, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold',
                        opacity: (mode === 'TRANSFER' && !targetCharId) ? 0.5 : 1
                    }}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
